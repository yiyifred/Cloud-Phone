import { createReadStream, createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

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

/**
 * Stream a local file to the client in bounded chunks.
 *
 * Why this exists next to `sendProtectedBuffer`: base64-in-JSON needs the whole
 * file plus a 4/3 encoding plus the JSON string in the heap at once, so a
 * 200 MB download peaked around 530 MB. Piping keeps peak heap at one chunk.
 *
 * Headers are flushed before the first byte; a failure after that point cannot
 * become a JSON error, so callers must handle `headersSent` themselves.
 *
 * @param {import("node:http").ServerResponse} res
 * @param {string} localPath
 * @param {{ contentType?: string, contentLength?: number, extraHeaders?: Record<string, string> }} [options]
 */
export async function pipeProtectedFileToResponse(res, localPath, options = {}) {
  const {
    contentType = "application/octet-stream",
    contentLength,
    extraHeaders = {},
  } = options;

  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    ...extraHeaders,
  };

  if (Number.isFinite(contentLength) && contentLength >= 0) {
    headers["Content-Length"] = contentLength;
  }

  res.writeHead(200, headers);

  await pipeline(createReadStream(localPath, { highWaterMark: 64 * 1024 }), res);
}

/**
 * Stream a request body to disk, refusing to write past `maxBytes`.
 *
 * The counter runs inside the pipeline, so an oversized chunked upload is
 * stopped while only one chunk is resident instead of being buffered first.
 * On any failure the caller owns the partial file and must remove it.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {string} localPath
 * @param {number} maxBytes
 * @returns {Promise<{ bytes: number }>}
 */
export async function receiveProtectedUploadBody(req, localPath, maxBytes) {
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 0;
  const declared = Number(req.headers["content-length"]);

  if (limit && Number.isFinite(declared) && declared > limit) {
    const error = new Error(`Request body exceeds ${limit} bytes.`);
    error.code = "request_body_too_large";
    error.statusCode = 413;
    // Drain instead of destroying so the client can read the JSON error.
    req.resume();
    throw error;
  }

  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;

      if (limit && received > limit) {
        const error = new Error(`Request body exceeds ${limit} bytes.`);
        error.code = "request_body_too_large";
        error.statusCode = 413;
        error.bytes = received;
        callback(error);
        return;
      }

      callback(null, chunk);
    },
  });

  await pipeline(req, meter, createWriteStream(localPath));

  return { bytes: received };
}
