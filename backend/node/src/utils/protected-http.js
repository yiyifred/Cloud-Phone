import {
  decryptPayload,
  encryptPayload,
  derivePasswordEnvelopeKey,
} from "./api-crypto.js";
import { readJsonBody, sendJson } from "./http.js";

/**
 * Shared wire key for bootstrap/login envelopes.
 *
 * This is OBFUSCATION, not transport security: the key is a public constant in
 * this repository, so anyone who can read the wire can also decrypt it. Real
 * confidentiality comes from TLS at the frontend proxy plus binding the backend
 * to loopback. Do not describe this as encryption of the password in docs.
 */
export const LOGIN_WIRE_PURPOSE = "login-request-wire-v1";
export const LOGIN_WIRE_SECRET = "cloud-phone";

export function getLoginWireKey() {
  return derivePasswordEnvelopeKey(LOGIN_WIRE_SECRET, LOGIN_WIRE_PURPOSE);
}

export function attachResponseEncryption(res, encryptionKey) {
  res.apiEncryptionKey = encryptionKey;
}

/** Encrypt with the fixed login-wire key (public / bootstrap endpoints). */
export function sendLoginWireProtectedJson(res, statusCode, payload, extraHeaders = {}) {
  sendJson(res, statusCode, encryptPayload(payload, getLoginWireKey()), extraHeaders);
}

/**
 * Authenticated responses: session key required.
 * If missing, fall back to login-wire so nothing is ever cleartext JSON.
 */
export function sendProtectedJson(res, statusCode, payload, extraHeaders = {}) {
  const key = res.apiEncryptionKey || getLoginWireKey();
  sendJson(res, statusCode, encryptPayload(payload, key), extraHeaders);
}

export function sendPasswordProtectedJson(res, statusCode, payload, password, extraHeaders = {}) {
  const key = derivePasswordEnvelopeKey(password, "login-response-v1");
  sendJson(res, statusCode, encryptPayload(payload, key), extraHeaders);
}

export async function readProtectedJsonBody(req, res) {
  const raw = await readJsonBody(req);
  const key = res?.apiEncryptionKey;

  if (!key) {
    throw new Error("session_encryption_key_required");
  }

  if (!raw || Object.keys(raw).length === 0) {
    return {};
  }

  if (!raw?.encrypted) {
    throw new Error("encrypted_body_required");
  }

  return decryptPayload(raw, key);
}

export async function readLoginWireProtectedJsonBody(req) {
  const raw = await readJsonBody(req);

  if (!raw?.encrypted) {
    throw new Error("encrypted_body_required");
  }

  return decryptPayload(raw, getLoginWireKey());
}

export async function readPasswordProtectedJsonBody(req, password, purpose = "login-request-v1") {
  const raw = await readJsonBody(req);

  if (!raw?.encrypted) {
    throw new Error("encrypted_body_required");
  }

  return decryptPayload(raw, derivePasswordEnvelopeKey(password, purpose));
}

export async function readProtectedBinaryBody(req, res) {
  const body = await readProtectedJsonBody(req, res);
  const data = body?.data;

  if (typeof data !== "string" || !data) {
    throw new Error("encrypted_binary_required");
  }

  return {
    buffer: Buffer.from(data, "base64"),
    path: typeof body.path === "string" ? body.path : null,
    meta: body,
  };
}

export function sendProtectedBuffer(res, statusCode, buffer, contentType, extraHeaders = {}) {
  sendProtectedJson(
    res,
    statusCode,
    {
      success: true,
      contentType,
      data: buffer.toString("base64"),
    },
    extraHeaders,
  );
}
