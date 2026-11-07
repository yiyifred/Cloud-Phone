import crypto from "node:crypto";

const ENVELOPE_VERSION = 1;

/**
 * Fixed salt on purpose: the envelope must be derivable by a client that only
 * knows the password (login response). It buys obfuscation, not secrecy — see
 * the note in protected-http.js. Confidentiality is TLS's job.
 */
export function derivePasswordEnvelopeKey(password, purpose) {
  return crypto.pbkdf2Sync(String(password), `cloud-phone:${purpose}`, 100_000, 32, "sha256");
}

export function createSessionEncryptionKey() {
  return crypto.randomBytes(32);
}

export function encryptPayload(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", normalizeKey(key), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: true,
    v: ENVELOPE_VERSION,
    payload: Buffer.concat([iv, authTag, ciphertext]).toString("base64"),
  };
}

export function decryptPayload(envelope, key) {
  if (!envelope?.encrypted || !envelope?.payload) {
    throw new Error("encrypted_payload_required");
  }

  const buffer = Buffer.from(envelope.payload, "base64");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", normalizeKey(key), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

function normalizeKey(key) {
  if (Buffer.isBuffer(key)) {
    return key.length === 32 ? key : crypto.createHash("sha256").update(key).digest();
  }

  const buffer = Buffer.from(String(key), "base64");
  return buffer.length === 32 ? buffer : crypto.createHash("sha256").update(String(key)).digest();
}
