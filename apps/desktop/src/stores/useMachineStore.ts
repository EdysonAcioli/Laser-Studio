import { create } from "zustand";
import type { MachineConfig } from "@laser/shared-types";

export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  friendlyName?: string;
}

export interface MachineState {
  state: ConnectionState;
  port: string;
  baudRate: number;
  firmware: string;
  lastCommand: string;
  statusText: string;
  availablePorts: SerialPortInfo[];
  machineStatus: string;
  machinePosition: { x: number; y: number; z: number };
  /** Work position (mm) — maps to the design/canvas coordinates. */
  workPosition: { x: number; y: number; z: number };
  setPort: (port: string) => void;
  setBaudRate: (baudRate: number) => void;
  setFirmware: (firmware: string) => void;
  refreshPorts: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
}

const defaultConfig: MachineConfig = {
  name: "Default Laser",
  workspaceWidth: 600,
  workspaceHeight: 400,
  maxSpeed: 5000,
  acceleration: 500,
  firmware: "grbl",
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  pwmMin: 0,
  pwmMax: 1000,
  cameraOffsetX: 0,
  cameraOffsetY: 0,
};

let initialized = false;
let statusPolling: ReturnType<typeof setInterval> | null = null;
// GRBL only reports the work-coordinate offset (WCO) intermittently, so we
// remember the last one to convert MPos → work position between reports.
let lastWco = { x: 0, y: 0, z: 0 };

function parseTriple(line: string, label: string) {
  const match = line.match(
    new RegExp(`${label}:([\\-\\d.]+),([\\-\\d.]+),([\\-\\d.]+)`),
  );
  return match
    ? { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) }
    : null;
}

function parseStatusLine(line: string) {
  const statusMatch = line.match(/^<([^|>]+)/);
  const mpos = parseTriple(line, "MPos");
  const wpos = parseTriple(line, "WPos");
  const wco = parseTriple(line, "WCO");

  if (!statusMatch && !mpos && !wpos) {
    return null;
  }

  if (wco) {
    lastWco = wco;
  }

  const machinePosition = mpos ?? (wpos ? add(wpos, lastWco) : null);
  const workPosition = wpos ?? (mpos ? subtract(mpos, lastWco) : null);

  return {
    machineStatus: statusMatch?.[1] ?? "unknown",
    machinePosition,
    workPosition,
  };
}

function add(a: { x: number; y: number; z: number }, b: typeof a) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a: { x: number; y: number; z: number }, b: typeof a) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function ensureMachineListeners() {
  if (initialized || !window.electron?.on) {
    return;
  }

  initialized = true;

  window.electron.on("laser:machine-state", (payload) => {
    const statePayload = payload as {
      state: ConnectionState;
      port?: string;
      baudRate?: number;
    };

    useMachineStore.setState((state) => ({
      state: statePayload.state,
      port: statePayload.port ?? state.port,
      baudRate: statePayload.baudRate ?? state.baudRate,
      statusText:
        statePayload.state === "connected"
          ? `Conectado em ${statePayload.port ?? state.port}`
          : "Desconectado",
    }));

    if (statePayload.state === "connected") {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
      statusPolling = setInterval(() => {
        void useMachineStore.getState().sendCommand("?");
      }, 500);
    } else if (statusPolling) {
      clearInterval(statusPolling);
      statusPolling = null;
    }
  });

  window.electron.on("laser:machine-data", (payload) => {
    const line = String(payload ?? "");
    const parsed = parseStatusLine(line);
    useMachineStore.setState((state) => ({
      statusText: line || state.statusText,
      machineStatus: parsed?.machineStatus ?? state.machineStatus,
      machinePosition: parsed?.machinePosition ?? state.machinePosition,
      workPosition: parsed?.workPosition ?? state.workPosition,
    }));
  });

  window.electron.on("laser:machine-command", (payload) => {
    const command = String(payload ?? "");
    useMachineStore.setState({ lastCommand: command });
  });

  window.electron.on("laser:machine-error", (payload) => {
    useMachineStore.setState({
      state: "disconnected",
      statusText: String(payload ?? "Erro de comunicação"),
    });
    if (statusPolling) {
      clearInterval(statusPolling);
      statusPolling = null;
    }
  });
}

export const useMachineStore = create<MachineState>((set) => ({
  state: "disconnected",
  port: "COM3",
  baudRate: 115200,
  firmware: defaultConfig.firmware,
  lastCommand: "",
  statusText: "Desconectado",
  availablePorts: [],
  machineStatus: "idle",
  machinePosition: { x: 0, y: 0, z: 0 },
  workPosition: { x: 0, y: 0, z: 0 },
  setPort: (port) => set({ port }),
  setBaudRate: (baudRate) => set({ baudRate }),
  setFirmware: (firmware) => set({ firmware }),
  refreshPorts: async () => {
    ensureMachineListeners();
    const ports = (await window.electron?.invoke("laser:list-ports")) as
      | SerialPortInfo[]
      | undefined;
    set({
      availablePorts: ports ?? [],
      port: ports?.[0]?.path ?? useMachineStore.getState().port,
    });
  },
  connect: async () => {
    ensureMachineListeners();
    const state = useMachineStore.getState();
    set({ state: "connecting", statusText: "Conectando..." });
    await window.electron?.invoke("laser:connect", {
      path: state.port,
      baudRate: state.baudRate,
    });
  },
  disconnect: async () => {
    ensureMachineListeners();
    await window.electron?.invoke("laser:disconnect");
    set({ state: "disconnected", statusText: "Desconectado" });
  },
  sendCommand: async (command) => {
    ensureMachineListeners();
    try {
      await window.electron?.invoke("laser:send-command", command);
      set({ lastCommand: command, statusText: `Último comando: ${command}` });
    } catch (error) {
      set({ statusText: String(error) });
    }
  },
}));
