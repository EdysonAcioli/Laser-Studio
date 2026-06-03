import { useState, useRef, useEffect } from "react";
import { useCanvasStore } from "../stores/useCanvasStore";
import { useLayerStore } from "../stores/useLayerStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { saveProject, openProject } from "../utils/projectFile";

type TopbarProps = {
  systemInfo: { platform: string; version: string };
};

function DropdownMenu({
  items,
  onClose,
}: {
  items: { label: string; action: () => void; separator?: boolean }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded border border-border bg-[#1a2030] shadow-xl"
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="my-1 border-t border-border" />
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.action();
              onClose();
            }}
            className="block w-full px-4 py-2 text-left text-xs text-slate-200 hover:bg-[#27334b] transition"
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

export function Topbar({ systemInfo }: TopbarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const objects = useCanvasStore((state) => state.objects);
  const clearObjects = useCanvasStore((state) => state.clearObjects);
  const setObjects = useCanvasStore((state) => state.setObjects);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const layers = useLayerStore((state) => state.layers);
  const setLayers = useLayerStore((state) => state.setLayers);
  const machineConfig = useSettingsStore((state) => state.machineConfig);
  const setMachineConfig = useSettingsStore((state) => state.setMachineConfig);

  const toggleMenu = (name: string) =>
    setOpenMenu((prev) => (prev === name ? null : name));

  const menus: Record<
    string,
    { label: string; action: () => void; separator?: boolean }[]
  > = {
    Arquivo: [
      {
        label: "Novo projeto",
        action: () => {
          if (window.confirm("Limpar canvas e criar novo projeto?"))
            clearObjects();
        },
      },
      {
        label: "Abrir projeto (.lightproj)",
        action: async () => {
          try {
            const proj = await openProject();
            setLayers(proj.layers);
            setMachineConfig(proj.machineConfig);
            setObjects(proj.objects);
          } catch (e) {
            alert((e as Error).message);
          }
        },
      },
      { label: "", action: () => {}, separator: true },
      {
        label: "Salvar projeto",
        action: () =>
          saveProject({
            projectName: "Meu Projeto",
            objects,
            layers,
            machineConfig,
          }),
      },
      { label: "", action: () => {}, separator: true },
      { label: "Sair", action: () => window.electron?.invoke("laser:quit") },
    ],
    Editar: [
      { label: "Desfazer (Ctrl+Z)", action: () => undo() },
      { label: "Refazer (Ctrl+Y)", action: () => redo() },
      { label: "", action: () => {}, separator: true },
      { label: "Limpar canvas", action: () => clearObjects() },
    ],
    Máquina: [
      { label: "Conectar", action: () => {} },
      { label: "Desconectar", action: () => {} },
      { label: "", action: () => {}, separator: true },
      {
        label: "Listar portas seriais",
        action: () =>
          window.electron?.invoke("laser:list-ports").then(console.log),
      },
    ],
    Ajuda: [
      {
        label: "Atalhos de teclado",
        action: () =>
          alert(
            "V=Sel  R=Rect  C=Círculo  L=Linha  B=Bezier  T=Texto  P=Pan  Z=Zoom  Del=Excluir  Esc=Sel",
          ),
      },
      {
        label: "Sobre Laser Studio",
        action: () =>
          alert(
            "Laser Studio v1.0.0\nDesktop CAD/CAM para CNC Laser\n\nFeito com Electron + React + TypeScript",
          ),
      },
    ],
  };

  return (
    <header className="relative z-40 flex items-center justify-between border-b border-border bg-[#11151b] px-4 py-2">
      <div className="flex items-center gap-3 text-sm text-slate-200">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-bold text-white">
          L
        </div>
        <span className="font-semibold tracking-wide">Laser Studio</span>
        <span className="text-xs text-slate-500">CAD/CAM</span>
      </div>

      <nav className="flex items-center gap-1 text-slate-300">
        {Object.keys(menus).map((name) => (
          <div key={name} className="relative">
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm transition ${openMenu === name ? "bg-[#1f2730] text-white" : "hover:bg-[#1a2030]"}`}
              onClick={() => toggleMenu(name)}
            >
              {name}
            </button>
            {openMenu === name && (
              <DropdownMenu
                items={menus[name]}
                onClose={() => setOpenMenu(null)}
              />
            )}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>{objects.length} obj</span>
        <span>
          {systemInfo.platform} · v{systemInfo.version}
        </span>
      </div>
    </header>
  );
}
