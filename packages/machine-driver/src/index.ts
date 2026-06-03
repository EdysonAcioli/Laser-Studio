import { EventEmitter } from "events";

export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface MachineDriverOptions {
  port: string;
  baudRate?: number;
  protocol?: "serial" | "wifi" | "ethernet";
}

export class MachineDriver extends EventEmitter {
  state: ConnectionState = "disconnected";
  options: MachineDriverOptions;

  constructor(options: MachineDriverOptions) {
    super();
    this.options = options;
  }

  async connect() {
    this.state = "connecting";
    this.emit("state", this.state);
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.state = "connected";
    this.emit("state", this.state);
  }

  async disconnect() {
    this.state = "disconnected";
    this.emit("state", this.state);
  }

  async sendCommand(command: string) {
    this.emit("command", command);
    console.log("[MachineDriver] send:", command);
  }

  async pause() {
    await this.sendCommand("!");
  }

  async resume() {
    await this.sendCommand("~");
  }

  async stop() {
    await this.sendCommand("M5");
  }

  async jog(axis: "x" | "y" | "z", distance: number, feedRate: number) {
    await this.sendCommand(
      `G91 G0 ${axis.toUpperCase()}${distance.toFixed(3)} F${feedRate}`,
    );
  }
}
