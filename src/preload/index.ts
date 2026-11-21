import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI } from "../shared/types";

export interface SystemOcrPayload {
  bytes: Uint8Array;
  mimeType?: string;
}

export interface SystemOcrResult {
  text: string;
  confidence?: number;
  note?: string;
}

export interface AudioTranscribePayload {
  bytes: Uint8Array;
  mimeType?: string;
  fileName?: string;
}

export interface AudioTranscribeResult {
  text: string;
  confidence?: number;
  note?: string;
}

const electronAPI: ElectronAPI & {
  ocrSystem?: (payload: SystemOcrPayload) => Promise<SystemOcrResult>;
  transcribeAudio?: (
    payload: AudioTranscribePayload,
  ) => Promise<AudioTranscribeResult>;
} = {
  search: (query: string) => ipcRenderer.invoke("perform-search", query),
  encrypt: (text: string) => ipcRenderer.invoke("crypto:encrypt", text),
  decrypt: (cipherText: string) =>
    ipcRenderer.invoke("crypto:decrypt", cipherText),
  ocrSystem: (payload: SystemOcrPayload) =>
    ipcRenderer.invoke("ocr:system", payload),
  transcribeAudio: (payload: AudioTranscribePayload) =>
    ipcRenderer.invoke("audio:transcribe", payload),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
