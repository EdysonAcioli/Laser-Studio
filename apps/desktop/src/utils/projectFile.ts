import type {
  VectorObject,
  LayerConfig,
  MachineConfig,
} from "@laser/shared-types";

export interface LightProjFile {
  version: "1.0";
  projectName: string;
  createdAt: string;
  modifiedAt: string;
  objects: VectorObject[];
  layers: LayerConfig[];
  machineConfig: MachineConfig;
}

export function saveProject(
  data: Omit<LightProjFile, "version" | "createdAt" | "modifiedAt">,
) {
  const project: LightProjFile = {
    version: "1.0",
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    ...data,
  };
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.projectName || "projeto"}.lightproj`;
  a.click();
  URL.revokeObjectURL(url);
}

export function openProject(): Promise<LightProjFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".lightproj,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("Nenhum arquivo selecionado"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as LightProjFile;
          resolve(data);
        } catch (err) {
          reject(new Error("Arquivo de projeto inválido"));
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsText(file);
    };
    input.click();
  });
}
