import { useEffect } from "react";
import { useCanvasStore, type ToolType } from "../stores/useCanvasStore";
import { useMachineStore } from "../stores/useMachineStore";

const TOOL_KEYS: Record<string, ToolType> = {
  v: "select",
  n: "node",
  l: "line",
  r: "rectangle",
  c: "circle",
  e: "ellipse",
  p: "path",
  b: "bezier",
  t: "text",
  h: "pan",
  z: "zoom",
  m: "measure",
  o: "offset",
};

export function useKeyboardShortcuts() {
  const {
    setSelectedTool,
    removeObjects,
    selectedIds,
    selectAll,
    undo,
    redo,
  } = useCanvasStore();
  const { sendCommand, state } = useMachineStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when focused on input elements
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();

      // Tool shortcuts (single key)
      if (!e.ctrlKey && !e.metaKey && TOOL_KEYS[key]) {
        setSelectedTool(TOOL_KEYS[key]);
        return;
      }

      // Delete selected objects
      if (key === "delete" || key === "backspace") {
        if (selectedIds.length) removeObjects(selectedIds);
        return;
      }

      if (e.ctrlKey && key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if (
        (e.ctrlKey && key === "y") ||
        (e.ctrlKey && e.shiftKey && key === "z")
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Emergency stop
      if (e.ctrlKey && key === "e") {
        e.preventDefault();
        if (state === "connected") sendCommand("\x18");
        return;
      }

      // Select all
      if (e.ctrlKey && key === "a") {
        e.preventDefault();
        selectAll();
        return;
      }

      // Escape → select tool
      if (key === "escape") {
        setSelectedTool("select");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    setSelectedTool,
    removeObjects,
    selectedIds,
    selectAll,
    sendCommand,
    state,
    undo,
    redo,
  ]);
}
