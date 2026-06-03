/// <reference types="vite/client" />

declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (
        channel: string,
        listener: (...args: unknown[]) => void,
      ) => () => void;
    };
  }
}

export {};
