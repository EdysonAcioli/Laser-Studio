import { pluginManager } from "@laser/plugin-sdk";
import type { PluginTool } from "@laser/plugin-sdk";

export const registerBuiltInTools = () => {
  const builtIns: PluginTool[] = [
    {
      id: "select",
      name: "Selecionar",
      icon: "cursor-arrow",
      onActivate: () => console.log("Ferramenta Selecionar ativada"),
    },
    {
      id: "line",
      name: "Linha",
      icon: "line",
      onActivate: () => console.log("Ferramenta Linha ativada"),
    },
    {
      id: "rectangle",
      name: "Retângulo",
      icon: "square",
      onActivate: () => console.log("Ferramenta Retângulo ativada"),
    },
    {
      id: "circle",
      name: "Círculo",
      icon: "circle",
      onActivate: () => console.log("Ferramenta Círculo ativada"),
    },
  ];

  builtIns.forEach(pluginManager.registerTool.bind(pluginManager));
};

export const getRegisteredTools = () => pluginManager.getTools();
