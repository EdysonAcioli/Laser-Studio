import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { LayerPanel } from "./components/LayerPanel";
import { EditorCanvas } from "./components/EditorCanvas";
import { StatusBar } from "./components/StatusBar";
import { MachineControlPanel } from "./components/panels/MachineControlPanel";
import { GcodePanel } from "./components/panels/GcodePanel";
import { MaterialLibraryPanel } from "./components/panels/MaterialLibraryPanel";
import { JogPanel } from "./components/panels/JogPanel";
import { SimulationCanvas } from "./components/panels/SimulationCanvas";
import { SvgImporterPanel } from "./components/panels/SvgImporterPanel";
import { ImageProcessorPanel } from "./components/panels/ImageProcessorPanel";
import { PropertiesPanel } from "./components/panels/PropertiesPanel";
import { MachineSettingsPanel } from "./components/panels/MachineSettingsPanel";
import { registerBuiltInTools } from "./plugins/pluginManager";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useCanvasStore } from "./stores/useCanvasStore";

type RightTab = "layers" | "properties" | "machine" | "settings";
type BottomTab = "gcode" | "simulation" | "materials" | "import" | "image";

function App() {
  const [systemInfo, setSystemInfo] = useState({
    platform: "unknown",
    version: "unknown",
  });
  const [rightTab, setRightTab] = useState<RightTab>("layers");
  const [bottomTab, setBottomTab] = useState<BottomTab>("gcode");
  const activeObjectId = useCanvasStore((state) => state.activeObjectId);

  useKeyboardShortcuts();

  useEffect(() => {
    registerBuiltInTools();
    window.electron
      ?.invoke("laser:get-system-info")
      .then((info) => setSystemInfo(info as any));
  }, []);

  useEffect(() => {
    if (activeObjectId) {
      setRightTab("properties");
    }
  }, [activeObjectId]);

  const rightTabs: { id: RightTab; label: string }[] = [
    { id: "layers", label: "Camadas" },
    { id: "properties", label: "Objetos" },
    { id: "machine", label: "Máquina" },
    { id: "settings", label: "Config." },
  ];

  const bottomTabs: { id: BottomTab; label: string }[] = [
    { id: "gcode", label: "G-code" },
    { id: "simulation", label: "Simulação" },
    { id: "materials", label: "Materiais" },
    { id: "import", label: "Importar SVG" },
    { id: "image", label: "Imagem → Laser" },
  ];

  const tabBtnCls = (active: boolean) =>
    `px-3 py-1.5 text-xs rounded-t transition border-b-2 ${
      active
        ? "border-accent text-white bg-[#1a2030]"
        : "border-transparent text-slate-400 hover:text-white hover:bg-[#151c25]"
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-surface text-white overflow-hidden">
      <Topbar systemInfo={systemInfo} />

      <div
        className="flex flex-1 overflow-visible"
        style={{ height: "calc(100vh - 64px - 28px)" }}
      >
        {/* Left sidebar: tools */}
        <Sidebar />

        {/* Center: canvas + bottom panels */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 overflow-hidden bg-[#0d1117]">
            <EditorCanvas />
          </div>

          {/* Bottom panel */}
          <div
            className="border-t border-border bg-[#11151b]"
            style={{ height: 340 }}
          >
            <div className="flex border-b border-border px-3 pt-1">
              {bottomTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tabBtnCls(bottomTab === t.id)}
                  onClick={() => setBottomTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto p-4" style={{ height: 295 }}>
              {bottomTab === "gcode" && <GcodePanel />}
              {bottomTab === "simulation" && <SimulationCanvas />}
              {bottomTab === "materials" && <MaterialLibraryPanel />}
              {bottomTab === "import" && <SvgImporterPanel />}
              {bottomTab === "image" && <ImageProcessorPanel />}
            </div>
          </div>
        </div>

        {/* Right sidebar: layers / properties / machine / settings */}
        <div
          className="flex flex-col border-l border-border bg-[#161b21]"
          style={{ width: 300 }}
        >
          <div className="flex border-b border-border px-2 pt-1">
            {rightTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tabBtnCls(rightTab === t.id)}
                onClick={() => setRightTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {rightTab === "layers" && <LayerPanel />}
            {rightTab === "properties" && <PropertiesPanel />}
            {rightTab === "machine" && (
              <div className="space-y-3">
                <MachineControlPanel />
                <JogPanel />
              </div>
            )}
            {rightTab === "settings" && <MachineSettingsPanel />}
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}

export default App;
