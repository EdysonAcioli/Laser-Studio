import { app, BrowserWindow, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { autoUpdater } from "electron-updater";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

console.log(
  "Electron main starting with temp userData path:",
  app.getPath("temp"),
);
const userDataPath = path.join(app.getPath("temp"), "laser-studio-electron");
const cacheDir = path.join(userDataPath, "cache");
fs.mkdirSync(cacheDir, { recursive: true });
app.disableHardwareAcceleration();
app.setPath("userData", userDataPath);
app.setPath("userCache", cacheDir);
app.setPath("cache", cacheDir);
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-gpu-driver-debugging");
app.commandLine.appendSwitch("disable-accelerated-2d-canvas");
app.commandLine.appendSwitch("disable-cache");
app.commandLine.appendSwitch("disable-application-cache");
app.commandLine.appendSwitch("disk-cache-dir", cacheDir);
app.commandLine.appendSwitch("no-sandbox");

let machinePort: SerialPort | null = null;
let machineParser: ReadlineParser | null = null;

function broadcast(channel: string, payload: unknown) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, payload);
  });
}

async function closeMachinePort() {
  if (!machinePort) {
    return;
  }

  const port = machinePort;
  machinePort = null;
  machineParser = null;

  if (port.isOpen) {
    await new Promise<void>((resolve, reject) => {
      port.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }).catch((error) => {
      broadcast("laser:machine-error", String(error));
    });
  }

  broadcast("laser:machine-state", { state: "disconnected" });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1200,
    minHeight: 780,
    backgroundColor: "#101318",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
    },
  });

  function showMainWindow() {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:4173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "index.html"));
  }

  mainWindow.once("ready-to-show", showMainWindow);
  mainWindow.on("show", () => mainWindow.focus());
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.whenReady().then(() => {
  createWindow();
  if (process.env.NODE_ENV !== "development") {
    void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error("AutoUpdater error:", error);
    });
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle("laser:get-system-info", async () => ({
  platform: process.platform,
  version: process.version,
}));

ipcMain.handle("laser:quit", () => {
  app.quit();
});

ipcMain.handle("laser:list-ports", async () => {
  const ports = await SerialPort.list();
  return ports.map((port) => ({
    path: port.path,
    manufacturer: port.manufacturer ?? "",
    friendlyName: [port.path, port.manufacturer].filter(Boolean).join(" - "),
  }));
});

ipcMain.handle(
  "laser:connect",
  async (_event, options: { path: string; baudRate: number }) => {
    await closeMachinePort();

    const port = new SerialPort({
      path: options.path,
      baudRate: options.baudRate,
      autoOpen: false,
    });

    await new Promise<void>((resolve, reject) => {
      port.open((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    machinePort = port;
    machineParser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    machineParser.on("data", (line: string) => {
      broadcast("laser:machine-data", line);
    });

    port.on("error", (error) => {
      broadcast("laser:machine-error", error.message);
    });

    port.on("close", () => {
      broadcast("laser:machine-state", { state: "disconnected" });
    });

    broadcast("laser:machine-state", {
      state: "connected",
      port: options.path,
      baudRate: options.baudRate,
    });

    return { ok: true };
  },
);

ipcMain.handle("laser:disconnect", async () => {
  await closeMachinePort();
  return { ok: true };
});

ipcMain.handle("laser:send-command", async (_event, command: string) => {
  if (!machinePort || !machinePort.isOpen) {
    throw new Error("Máquina não conectada");
  }

  const payload = command === "\x18" ? command : `${command}\n`;
  await new Promise<void>((resolve, reject) => {
    machinePort?.write(payload, (error) => {
      if (error) {
        reject(error);
        return;
      }
      machinePort?.drain((drainError) => {
        if (drainError) {
          reject(drainError);
          return;
        }
        resolve();
      });
    });
  });

  broadcast("laser:machine-command", command);
  return { ok: true };
});
