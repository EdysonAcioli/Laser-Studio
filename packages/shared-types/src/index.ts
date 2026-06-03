export type VectorObjectType =
  | "line"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "polygon"
  | "text"
  | "svg"
  | "bitmap"
  | "path"
  | "bezier"
  | "dxf";

export type LayerMode = "fill" | "line" | "offset-fill" | "image";

export interface VectorObject {
  id: string;
  type: VectorObjectType;
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
  stroke: string;
  fill: string;
  power: number;
  speed: number;
  passes: number;
  layer: string;
  airAssist: boolean;
  zIndex: number;
  metadata?: Record<string, unknown>;
}

export interface LayerConfig {
  id: string;
  name: string;
  color: string;
  mode: LayerMode;
  power: number;
  speed: number;
  passes: number;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface MachineConfig {
  name: string;
  workspaceWidth: number;
  workspaceHeight: number;
  maxSpeed: number;
  acceleration: number;
  firmware: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  pwmMin: number;
  pwmMax: number;
  cameraOffsetX: number;
  cameraOffsetY: number;
}

export interface MaterialPreset {
  material: string;
  power: number;
  speed: number;
  passes: number;
}

export interface LightProjFile {
  version: string;
  projectName: string;
  createdAt: string;
  modifiedAt: string;
  objects: VectorObject[];
  layers: LayerConfig[];
  machineConfig: MachineConfig;
  camera: {
    zoom: number;
    x: number;
    y: number;
  };
  materialPresets: MaterialPreset[];
}
