export interface ElectronAPI {
  search: (query: string) => Promise<string>;
  encrypt: (text: string) => Promise<string>;
  decrypt: (cipherText: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
