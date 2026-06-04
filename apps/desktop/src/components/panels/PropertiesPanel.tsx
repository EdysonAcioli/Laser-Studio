import { useCanvasStore } from "../../stores/useCanvasStore";
import { useLayerStore } from "../../stores/useLayerStore";

const labelCls = "text-xs text-slate-400";
const inputCls =
  "w-full rounded border border-border bg-[#141a21] px-3 py-1.5 text-xs text-slate-100 focus:border-accent focus:outline-none";

export function PropertiesPanel() {
  const { objects, activeObjectId, updateObject } = useCanvasStore();
  const layers = useLayerStore((state) => state.layers);

  const obj = objects.find((o) => o.id === activeObjectId);
  const metadata = obj?.metadata ?? {};

  if (!obj) {
    return (
      <section className="rounded-xl border border-border bg-[#11151b] p-4 text-xs text-slate-500">
        <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">
          Propriedades
        </div>
        <p>Selecione um objeto no canvas para editar suas propriedades.</p>
      </section>
    );
  }

  const setMeta = (patch: Record<string, unknown>) =>
    updateObject(obj.id, { metadata: { ...metadata, ...patch } });

  const numberField = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    step = 1,
  ) => (
    <label className="grid gap-1">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        step={step}
        className={inputCls}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );

  return (
    <section className="rounded-xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
        <span>Propriedades</span>
        <span className="rounded bg-[#1f2730] px-2 py-0.5 text-xs text-slate-300">
          {obj.type}
        </span>
      </div>

      <div className="grid gap-3">
        {/* Posição */}
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className={labelCls}>X</span>
            <input
              type="number"
              className={inputCls}
              value={obj.position.x.toFixed(2)}
              onChange={(e) =>
                updateObject(obj.id, {
                  position: { ...obj.position, x: Number(e.target.value) },
                })
              }
            />
          </label>
          <label className="grid gap-1">
            <span className={labelCls}>Y</span>
            <input
              type="number"
              className={inputCls}
              value={obj.position.y.toFixed(2)}
              onChange={(e) =>
                updateObject(obj.id, {
                  position: { ...obj.position, y: Number(e.target.value) },
                })
              }
            />
          </label>
        </div>

        {/* Rotação / escala */}
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className={labelCls}>Rotação (°)</span>
            <input
              type="number"
              className={inputCls}
              value={obj.rotation.toFixed(1)}
              onChange={(e) =>
                updateObject(obj.id, { rotation: Number(e.target.value) })
              }
            />
          </label>
          <label className="grid gap-1">
            <span className={labelCls}>Escala X</span>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={obj.scale.x.toFixed(2)}
              onChange={(e) =>
                updateObject(obj.id, {
                  scale: { ...obj.scale, x: Number(e.target.value) },
                })
              }
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className={labelCls}>Escala Y</span>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={obj.scale.y.toFixed(2)}
              onChange={(e) =>
                updateObject(obj.id, {
                  scale: { ...obj.scale, y: Number(e.target.value) },
                })
              }
            />
          </label>
        </div>

        {/* Dimensões por tipo */}
        {(obj.type === "rectangle" ||
          obj.type === "bitmap" ||
          obj.type === "ellipse") && (
          <div className="grid grid-cols-2 gap-2">
            {numberField(
              "Largura (mm)",
              Number(metadata.width ?? 80),
              (v) => setMeta({ width: Math.max(1, v) }),
            )}
            {numberField(
              "Altura (mm)",
              Number(metadata.height ?? 50),
              (v) => setMeta({ height: Math.max(1, v) }),
            )}
          </div>
        )}
        {obj.type === "circle" && (
          <div className="grid grid-cols-2 gap-2">
            {numberField(
              "Raio (mm)",
              Number(metadata.radius ?? 30),
              (v) => setMeta({ radius: Math.max(0.5, v) }),
              0.5,
            )}
          </div>
        )}

        {/* Parâmetros de corte/gravação */}
        <div className="grid grid-cols-3 gap-2 rounded border border-border bg-[#101620] p-3">
          {numberField("Potência (%)", obj.power, (v) =>
            updateObject(obj.id, { power: Math.max(0, Math.min(100, v)) }),
          )}
          {numberField("Velocidade", obj.speed, (v) =>
            updateObject(obj.id, { speed: Math.max(1, v) }),
          )}
          {numberField("Passes", obj.passes, (v) =>
            updateObject(obj.id, { passes: Math.max(1, Math.round(v)) }),
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className={labelCls}>Camada</span>
            <select
              className={inputCls}
              value={obj.layer}
              onChange={(e) => updateObject(obj.id, { layer: e.target.value })}
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded border border-border bg-[#101620] p-3">
          <div className="mb-2 text-sm font-semibold text-slate-100">
            Cor da camada
          </div>
          <div className="grid gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f97316]" />
              <span>
                Cor de traçado e preenchimento definida pela camada ativa.
              </span>
            </div>
          </div>
        </div>

        {obj.type === "text" && (
          <div className="grid gap-3 rounded border border-border bg-[#101620] p-3">
            <div className="text-sm font-semibold text-slate-100">Texto</div>
            <label className="grid gap-1">
              <span className={labelCls}>Conteúdo</span>
              <input
                type="text"
                className={inputCls}
                value={String(metadata.text ?? "")}
                onChange={(e) =>
                  updateObject(obj.id, {
                    metadata: { ...metadata, text: e.target.value },
                  })
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className={labelCls}>Fonte</span>
                <select
                  className={inputCls}
                  value={String(metadata.fontFamily ?? "Arial")}
                  onChange={(e) =>
                    updateObject(obj.id, {
                      metadata: { ...metadata, fontFamily: e.target.value },
                    })
                  }
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className={labelCls}>Tamanho</span>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={Number(metadata.fontSize ?? 24)}
                  onChange={(e) =>
                    updateObject(obj.id, {
                      metadata: {
                        ...metadata,
                        fontSize: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(metadata.fontWeight === "bold")}
                  onChange={(e) =>
                    updateObject(obj.id, {
                      metadata: {
                        ...metadata,
                        fontWeight: e.target.checked ? "bold" : "normal",
                      },
                    })
                  }
                  className="h-4 w-4 rounded accent-accent"
                />
                <span className={labelCls}>Negrito</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(metadata.fontStyle === "italic")}
                  onChange={(e) =>
                    updateObject(obj.id, {
                      metadata: {
                        ...metadata,
                        fontStyle: e.target.checked ? "italic" : "normal",
                      },
                    })
                  }
                  className="h-4 w-4 rounded accent-accent"
                />
                <span className={labelCls}>Itálico</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(metadata.uppercase)}
                  onChange={(e) =>
                    updateObject(obj.id, {
                      metadata: {
                        ...metadata,
                        uppercase: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded accent-accent"
                />
                <span className={labelCls}>Maiúsculas</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className={labelCls}>Espaço H</span>
                <input
                  type="number"
                  step="0.1"
                  className={inputCls}
                  value={Number(metadata.letterSpacing ?? 0)}
                  onChange={(e) =>
                    updateObject(obj.id, {
                      metadata: {
                        ...metadata,
                        letterSpacing: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className={labelCls}>Espaço V</span>
                <input
                  type="number"
                  step="0.1"
                  className={inputCls}
                  value={Number(metadata.lineSpacing ?? 0)}
                  onChange={(e) =>
                    updateObject(obj.id, {
                      metadata: {
                        ...metadata,
                        lineSpacing: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>
          </div>
        )}

        {/* Air Assist */}
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={obj.airAssist}
            onChange={(e) =>
              updateObject(obj.id, { airAssist: e.target.checked })
            }
            className="h-4 w-4 rounded accent-accent"
          />
          <span className={labelCls}>Air Assist</span>
        </label>
      </div>
    </section>
  );
}
