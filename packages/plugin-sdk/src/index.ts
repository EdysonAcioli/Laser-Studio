import type {
  VectorObject,
  LayerConfig,
  MachineConfig,
  MaterialPreset,
} from "@laser/shared-types";

export type PluginTool = {
  id: string;
  name: string;
  icon?: string;
  group?: string;
  onActivate: () => void;
};

export type PluginImporter = {
  id: string;
  name: string;
  extensions: string[];
  import: (content: string | ArrayBuffer) => Promise<VectorObject[]>;
};

export type PluginExporter = {
  id: string;
  name: string;
  extensions: string[];
  export: (objects: VectorObject[]) => Promise<string>;
};

export type PluginMachine = {
  id: string;
  name: string;
  firmware: string;
  defaultConfig: MachineConfig;
};

export type PluginMaterialPreset = MaterialPreset;

export class PluginManager {
  private tools: PluginTool[] = [];
  private importers: PluginImporter[] = [];
  private exporters: PluginExporter[] = [];
  private machines: PluginMachine[] = [];

  registerTool(tool: PluginTool) {
    this.tools.push(tool);
    return tool;
  }

  registerImporter(importer: PluginImporter) {
    this.importers.push(importer);
    return importer;
  }

  registerExporter(exporter: PluginExporter) {
    this.exporters.push(exporter);
    return exporter;
  }

  registerMachine(machine: PluginMachine) {
    this.machines.push(machine);
    return machine;
  }

  getTools() {
    return [...this.tools];
  }

  getImporters() {
    return [...this.importers];
  }

  getExporters() {
    return [...this.exporters];
  }

  getMachines() {
    return [...this.machines];
  }
}

export const pluginManager = new PluginManager();
