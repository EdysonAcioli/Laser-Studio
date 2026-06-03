import {
  MousePointer,
  Circle,
  Square,
  Spline,
  PenTool,
  Type,
  Ruler,
  Move,
  ZoomIn,
  Layers,
  CircleDot,
  Slash,
} from "lucide-react";
import { useCanvasStore, ToolType } from "../stores/useCanvasStore";

const tools: Array<{
  id: ToolType;
  label: string;
  icon: typeof MousePointer;
  shortcut: string;
  description: string;
}> = [
  {
    id: "select",
    label: "Selecionar",
    icon: MousePointer,
    shortcut: "V",
    description: "Clique em um objeto para selecioná-lo e arraste para mover.",
  },
  {
    id: "node",
    label: "Nó",
    icon: CircleDot,
    shortcut: "N",
    description:
      "Clique em um nó de um caminho para arrastar e ajustar sua posição.",
  },
  {
    id: "line",
    label: "Linha",
    icon: Slash,
    shortcut: "L",
    description:
      "Clique e arraste para desenhar uma linha reta entre dois pontos.",
  },
  {
    id: "rectangle",
    label: "Retângulo",
    icon: Square,
    shortcut: "R",
    description:
      "Clique e arraste para desenhar um retângulo de tamanho livre.",
  },
  {
    id: "circle",
    label: "Círculo",
    icon: Circle,
    shortcut: "C",
    description: "Clique e arraste para desenhar um círculo ou elipse.",
  },
  {
    id: "path",
    label: "Caminho",
    icon: Spline,
    shortcut: "P",
    description:
      "Clique repetidamente para criar um caminho conectado por segmentos.",
  },
  {
    id: "bezier",
    label: "Bézier",
    icon: PenTool,
    shortcut: "B",
    description: "Clique para adicionar pontos de curva e crie curvas suaves.",
  },
  {
    id: "text",
    label: "Texto",
    icon: Type,
    shortcut: "T",
    description: "Clique no canvas para inserir texto e editar o conteúdo.",
  },
  {
    id: "measure",
    label: "Medição",
    icon: Ruler,
    shortcut: "M",
    description: "Clique e arraste para medir a distância entre dois pontos.",
  },
  {
    id: "pan",
    label: "Pan",
    icon: Move,
    shortcut: "H",
    description: "Clique e arraste para mover a vista do canvas.",
  },
  {
    id: "zoom",
    label: "Zoom",
    icon: ZoomIn,
    shortcut: "Z",
    description: "Use o mouse ou gesto para aproximar/afastar a vista.",
  },
  {
    id: "offset",
    label: "Offset",
    icon: Layers,
    shortcut: "O",
    description: "Clique em um objeto para criar um contorno paralelo.",
  },
];

export function Sidebar() {
  const selectedTool = useCanvasStore((state) => state.selectedTool);
  const setSelectedTool = useCanvasStore((state) => state.setSelectedTool);

  return (
    <aside className="relative z-20 w-20 border-r border-border bg-[#13181f] py-4">
      <div className="flex flex-col items-center gap-2 overflow-visible">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = selectedTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setSelectedTool(tool.id)}
              aria-label={`${tool.label} (${tool.shortcut})`}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-lg border transition ${
                isActive
                  ? "border-accent bg-[#27334b] text-white"
                  : "border-border bg-[#171d25] text-slate-200 hover:border-accent hover:text-white"
              }`}
            >
              <Icon size={20} />
              <span className="pointer-events-none absolute left-full top-3 hidden min-w-[200px] rounded-lg border border-border bg-[#0f172a] px-3 py-2 text-xs text-slate-100 shadow-lg group-hover:block z-50 whitespace-normal">
                <div className="font-semibold text-sm text-white">
                  {tool.label} ({tool.shortcut})
                </div>
                <div className="mt-1 text-[11px] leading-snug text-slate-300">
                  {tool.description}
                </div>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
