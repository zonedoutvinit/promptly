// types/electron.d.ts
export {};

declare global {
  interface Window {
    electronAPI: {
      search: (query: string) => Promise<string>;
    };
  }
}
