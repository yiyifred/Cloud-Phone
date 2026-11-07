const ENVELOPE_VERSION = 1;

function requireWebCryptoSubtle() {
  if (globalThis.crypto?.subtle) {
    return;
  }

  throw new Error(
    "当前访问环境不支持 Web Crypto（crypto.subtle）。请使用 localhost 或 HTTPS 访问。",
  );
}

export async function derivePasswordEnvelopeKey(password, purpose) {
  requireWebCryptoSubtle();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(`cloud-phone:${purpose}`),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return new Uint8Array(bits);
}

export async function deriveLoginResponseKey(password) {
  return derivePasswordEnvelopeKey(password, "login-response-v1");
}

export async function deriveLoginWireKey() {
  return derivePasswordEnvelopeKey("cloud-phone", "login-request-wire-v1");
}

export async function deriveLoginRequestKey(password) {
  return derivePasswordEnvelopeKey(password, "login-request-v1");
}

export async function encryptPayload(value, keyBytes) {
  requireWebCryptoSubtle();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await importAesKey(keyBytes);
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded),
  );
  const authTag = encrypted.slice(-16);
  const ciphertext = encrypted.slice(0, -16);
  const combined = new Uint8Array(12 + 16 + ciphertext.length);
  combined.set(iv, 0);
  combined.set(authTag, 12);
  combined.set(ciphertext, 28);

  return {
    encrypted: true,
    v: ENVELOPE_VERSION,
    payload: bytesToBase64(combined),
  };
}

export async function decryptPayload(envelope, keyBytes) {
  requireWebCryptoSubtle();
  if (!envelope?.encrypted || !envelope?.payload) {
    throw new Error("encrypted_payload_required");
  }

  const buffer = base64ToBytes(envelope.payload);
  const iv = buffer.slice(0, 12);
  const authTag = buffer.slice(12, 28);
  const ciphertext = buffer.slice(28);
  const cipherWithTag = new Uint8Array(ciphertext.length + authTag.length);
  cipherWithTag.set(ciphertext, 0);
  cipherWithTag.set(authTag, ciphertext.length);
  const cryptoKey = await importAesKey(keyBytes);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, cipherWithTag);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function importAesKey(keyBytes) {
  const normalized = await normalizeKey(keyBytes);
  return crypto.subtle.importKey("raw", normalized, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function normalizeKey(keyBytes) {
  if (keyBytes.byteLength === 32) {
    return keyBytes;
  }

  const digest = await crypto.subtle.digest("SHA-256", keyBytes);
  return new Uint8Array(digest);
}

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function base64ToKey(base64) {
  return base64ToBytes(base64);
}
