import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI } from "../shared/types";

const electronAPI: ElectronAPI = {
  search: (query: string) => ipcRenderer.invoke("perform-search", query),
  encrypt: (text: string) => ipcRenderer.invoke("crypto:encrypt", text),
  decrypt: (cipherText: string) =>
    ipcRenderer.invoke("crypto:decrypt", cipherText),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
