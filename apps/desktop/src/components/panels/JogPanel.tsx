import { useState } from "react";
import { useMachineStore } from "../../stores/useMachineStore";

const JOG_SPEEDS = [1, 5, 10, 50, 100];

export function JogPanel() {
  const { state, sendCommand } = useMachineStore();
  const [jogDist, setJogDist] = useState(10);
  const [jogSpeed, setJogSpeed] = useState(1000);
  const disabled = state !== "connected";

  const jog = (axis: string, dir: 1 | -1) => {
    const dist = dir * jogDist;
    sendCommand(`G91 G1 ${axis}${dist.toFixed(3)} F${jogSpeed}`);
  };

  const btn = (label: string, onClick: () => void, extra = "") => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded border border-border bg-[#1a2030] px-3 py-2 text-sm font-semibold text-slate-200 transition
        hover:border-accent hover:bg-[#27334b] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${extra}`}
    >
      {label}
    </button>
  );

  return (
    <section className="rounded-xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">
        Jog / Controle
      </div>

      {/* Jog XY */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <span />
        {btn("Y+", () => jog("Y", 1))}
        <span />
        {btn("X-", () => jog("X", -1))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => sendCommand("G28")}
          className="rounded border border-border bg-[#1a2030] px-3 py-2 text-xs text-slate-400 transition hover:bg-[#1f2730] disabled:opacity-40"
        >
          Home
        </button>
        {btn("X+", () => jog("X", 1))}
        <span />
        {btn("Y-", () => jog("Y", -1))}
        <span />
      </div>

      {/* Jog Z */}
      <div className="mb-4 flex gap-2">
        {btn("Z+", () => jog("Z", 1), "flex-1")}
        {btn("Z-", () => jog("Z", -1), "flex-1")}
      </div>

      {/* Distância step */}
      <div className="mb-3 grid gap-1 text-xs text-slate-400">
        <span>Distância (mm)</span>
        <div className="flex gap-1">
          {JOG_SPEEDS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setJogDist(d)}
              className={`flex-1 rounded border px-2 py-1 text-xs transition ${
                jogDist === d
                  ? "border-accent bg-[#27334b] text-white"
                  : "border-border bg-[#1a2030] text-slate-300 hover:border-accent"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Velocidade */}
      <div className="mb-4 grid gap-1 text-xs text-slate-400">
        <span>Velocidade F{jogSpeed}</span>
        <input
          type="range"
          min={100}
          max={6000}
          step={100}
          value={jogSpeed}
          onChange={(e) => setJogSpeed(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-2">
        {btn("Origem (G28)", () => sendCommand("G28"))}
        {btn("Unlock ($X)", () => sendCommand("$X"))}
        {btn("Laser ON", () => sendCommand("M3 S500"))}
        {btn("Laser OFF", () => sendCommand("M5"))}
      </div>

      {/* Emergency stop */}
      <button
        type="button"
        onClick={() => sendCommand("\x18")}
        className="mt-3 w-full rounded border border-red-700 bg-red-900/30 py-2 text-sm font-bold uppercase tracking-widest text-red-400 transition hover:bg-red-800/50"
      >
        ⚠ PARADA EMERGÊNCIA
      </button>
    </section>
  );
}
