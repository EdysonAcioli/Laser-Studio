import { VectorObject } from "@laser/shared-types";

export class CanvasEngine {
  private objects: VectorObject[] = [];

  addObject(item: VectorObject) {
    this.objects.push(item);
    return item;
  }

  updateObject(id: string, partial: Partial<VectorObject>) {
    const index = this.objects.findIndex((obj) => obj.id === id);
    if (index < 0) return null;
    this.objects[index] = { ...this.objects[index], ...partial };
    return this.objects[index];
  }

  removeObject(id: string) {
    this.objects = this.objects.filter((item) => item.id !== id);
  }

  getObjects() {
    return [...this.objects];
  }

  exportSVG() {
    return this.objects
      .map(
        (obj) =>
          `<g id="${obj.id}" transform="translate(${obj.position.x} ${obj.position.y}) rotate(${obj.rotation}) scale(${obj.scale.x} ${obj.scale.y})"><path d="M0 0"/></g>`,
      )
      .join("\n");
  }
}
