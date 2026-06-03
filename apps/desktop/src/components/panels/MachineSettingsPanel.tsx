import { useSettingsStore } from "../../stores/useSettingsStore";

const inputCls =
  "w-full rounded border border-border bg-[#141a21] px-3 py-1.5 text-xs text-slate-100 focus:border-accent focus:outline-none";
const labelCls = "text-xs text-slate-400";

export function MachineSettingsPanel() {
  const { machineConfig, setMachineConfig } = useSettingsStore();

  const num = (label: string, key: keyof typeof machineConfig) => (
    <label className="grid gap-1">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        className={inputCls}
        value={String(machineConfig[key])}
        onChange={(e) =>
          setMachineConfig({ [key]: Number(e.target.value) } as any)
        }
      />
    </label>
  );

  const str = (label: string, key: keyof typeof machineConfig) => (
    <label className="grid gap-1">
      <span className={labelCls}>{label}</span>
      <input
        type="text"
        className={inputCls}
        value={String(machineConfig[key])}
        onChange={(e) => setMachineConfig({ [key]: e.target.value } as any)}
      />
    </label>
  );

  return (
    <section className="rounded-xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">
        Configurações da máquina
      </div>

      <div className="grid gap-3">
        {str("Nome da máquina", "name")}

        <div className="grid grid-cols-2 gap-2">
          {num("Largura área (mm)", "workspaceWidth")}
          {num("Altura área (mm)", "workspaceHeight")}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {num("Vel. máxima (mm/min)", "maxSpeed")}
          {num("Aceleração", "acceleration")}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {num("PWM mín.", "pwmMin")}
          {num("PWM máx.", "pwmMax")}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {num("Offset X", "offsetX")}
          {num("Offset Y", "offsetY")}
          {num("Offset Z", "offsetZ")}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {num("Câmera Off. X", "cameraOffsetX")}
          {num("Câmera Off. Y", "cameraOffsetY")}
        </div>

        <label className="grid gap-1">
          <span className={labelCls}>Firmware</span>
          <select
            className={inputCls}
            value={machineConfig.firmware}
            onChange={(e) =>
              setMachineConfig({ firmware: e.target.value as any })
            }
          >
            <option value="grbl">GRBL</option>
            <option value="marlin">Marlin</option>
            <option value="smoothieware">Smoothieware</option>
            <option value="ruida">Ruida</option>
            <option value="esp32">ESP32 CNC</option>
          </select>
        </label>
      </div>
    </section>
  );
}
