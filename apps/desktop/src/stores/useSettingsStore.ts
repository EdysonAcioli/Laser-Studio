import { create } from "zustand";
import type { MachineConfig, MaterialPreset } from "@laser/shared-types";

export interface SettingsState {
  machineConfig: MachineConfig;
  materialPresets: MaterialPreset[];
  setMachineConfig: (config: Partial<MachineConfig>) => void;
  setMaterialPresets: (presets: MaterialPreset[]) => void;
  addMaterialPreset: (preset: MaterialPreset) => void;
  removeMaterialPreset: (material: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  machineConfig: {
    name: "Laser Studio 500",
    workspaceWidth: 700,
    workspaceHeight: 500,
    maxSpeed: 6000,
    acceleration: 700,
    firmware: "grbl",
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    pwmMin: 0,
    pwmMax: 1000,
    cameraOffsetX: 0,
    cameraOffsetY: 0,
  },
  materialPresets: [
    { material: "MDF 3mm", power: 80, speed: 300, passes: 1 },
    { material: "Acrílico 5mm", power: 75, speed: 250, passes: 2 },
  ],
  setMachineConfig: (patch) =>
    set((state) => ({
      machineConfig: { ...state.machineConfig, ...patch },
    })),
  setMaterialPresets: (materialPresets) => set({ materialPresets }),
  addMaterialPreset: (preset) =>
    set((state) => ({ materialPresets: [...state.materialPresets, preset] })),
  removeMaterialPreset: (material) =>
    set((state) => ({
      materialPresets: state.materialPresets.filter(
        (preset) => preset.material !== material,
      ),
    })),
}));
