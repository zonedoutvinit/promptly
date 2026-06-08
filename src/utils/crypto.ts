// src/utils/crypto.ts

const ENCRYPTION_SALT = new Uint8Array([
  80, 114, 111, 109, 112, 116, 108, 121, 76, 111, 99, 97, 108, 49, 50, 51,
]);

async function getKeyMaterial(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = await getKeyMaterial("promptly-sandbox-secret-auth");
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: ENCRYPTION_SALT,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptKey(secretText: string): Promise<string> {
  if (!secretText) return "";
  try {
    const cryptoKey = await getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();

    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      enc.encode(secretText),
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error("Encryption pipeline failure:", err);
    throw new Error("Failed to encrypt secret.");
  }
}

export async function decryptKey(cipherText: string): Promise<string> {
  if (!cipherText) return "";
  try {
    const cryptoKey = await getEncryptionKey();
    const combined = new Uint8Array(
      atob(cipherText)
        .split("")
        .map((c) => c.charCodeAt(0)),
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      data,
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.error("Decryption pipeline failure:", err);
    throw new Error("Failed to decrypt secret.");
  }
}
