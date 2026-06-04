import { useEffect } from "react";
import { useMachineStore } from "../../stores/useMachineStore";

export function MachineControlPanel() {
  const {
    state,
    port,
    baudRate,
    firmware,
    statusText,
    availablePorts,
    machineStatus,
    machinePosition,
    refreshPorts,
    connect,
    disconnect,
    sendCommand,
    setPort,
    setBaudRate,
    setFirmware,
  } = useMachineStore();

  const homeCommand = firmware === "grbl" ? "$H" : "G28 X0 Z0";

  useEffect(() => {
    void refreshPorts();
  }, [refreshPorts]);

  return (
    <section className="rounded-3xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
        <span>Controle da máquina</span>
        <span
          className={`rounded-full px-2 py-1 ${state === "connected" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-rose-300"}`}
        >
          {state}
        </span>
      </div>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs text-slate-400">
            Porta
            <select
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full rounded border border-border bg-[#161b21] px-3 py-2 text-slate-100"
            >
              {availablePorts.length === 0 ? (
                <option value={port}>{port || "Sem portas detectadas"}</option>
              ) : (
                availablePorts.map((item) => (
                  <option key={item.path} value={item.path}>
                    {item.friendlyName || item.path}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            Baud rate
            <input
              type="number"
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              className="w-full rounded border border-border bg-[#161b21] px-3 py-2 text-slate-100"
            />
          </label>
        </div>
        <label className="space-y-1 text-xs text-slate-400">
          Firmware
          <select
            value={firmware}
            onChange={(e) => setFirmware(e.target.value)}
            className="w-full rounded border border-border bg-[#161b21] px-3 py-2 text-slate-100"
          >
            <option value="grbl">GRBL</option>
            <option value="marlin">Marlin</option>
            <option value="ruida">Ruida</option>
            <option value="esp32">ESP32 CNC</option>
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => void connect()}
            className="rounded bg-[#1f2730] px-3 py-2 text-slate-200 transition hover:bg-[#27334b]"
          >
            Conectar
          </button>
          <button
            onClick={() => void disconnect()}
            className="rounded bg-[#1f2730] px-3 py-2 text-slate-200 transition hover:bg-[#27334b]"
          >
            Desconectar
          </button>
          <button
            onClick={() => void sendCommand("M5")}
            className="rounded bg-[#c2410c] px-3 py-2 text-slate-200 transition hover:bg-[#dc2626]"
          >
            Parar
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => void sendCommand(homeCommand)}
            className="rounded bg-[#2563eb] px-3 py-2 text-slate-200 transition hover:bg-[#1d4ed8]"
          >
            Home X/Z
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded border border-border bg-[#141a21] p-3 text-xs text-slate-400">
          <span>Status firmware: {machineStatus}</span>
          <span>
            X {machinePosition.x.toFixed(2)} / Y {machinePosition.y.toFixed(2)}{" "}
            / Z {machinePosition.z.toFixed(2)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void refreshPorts()}
          className="rounded bg-[#1a2030] px-3 py-2 text-xs text-slate-200 transition hover:bg-[#27334b]"
        >
          Atualizar portas
        </button>
        <div className="rounded border border-border bg-[#141a21] p-3 text-xs text-slate-400">
          {statusText}
        </div>
      </div>
    </section>
  );
}
