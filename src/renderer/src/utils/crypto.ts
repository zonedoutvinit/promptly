// src/utils/crypto.ts
export async function encryptKey(secretText: string): Promise<string> {
  if (!secretText) return "";
  try {
    return await window.electronAPI.encrypt(secretText);
  } catch (err) {
    console.error("Encryption pipeline failure:", err);
    throw new Error("Failed to encrypt secret.");
  }
}

export async function decryptKey(cipherText: string): Promise<string> {
  if (!cipherText) return "";
  try {
    return await window.electronAPI.decrypt(cipherText);
  } catch (err) {
    console.error("Decryption pipeline failure:", err);
    throw new Error("Failed to decrypt secret.");
  }
}
