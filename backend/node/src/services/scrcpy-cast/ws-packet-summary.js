/** Summarize ws-scrcpy WebSocket binary frames for cast debug logs. */

const MAGIC_INITIAL = Buffer.from("scrcpy_initial");
const MAGIC_MESSAGE = Buffer.from("scrcpy_message");
const MAGIC_AUDIO = Buffer.from("scrcpy_audio");

const CONTROL_TYPE_NAMES = {
  0: "INJECT_KEYCODE",
  1: "INJECT_TEXT",
  2: "INJECT_TOUCH_EVENT",
  3: "INJECT_SCROLL_EVENT",
  4: "BACK_OR_SCREEN_ON",
  5: "EXPAND_NOTIFICATION_PANEL",
  6: "EXPAND_SETTINGS_PANEL",
  7: "COLLAPSE_PANELS",
  8: "GET_CLIPBOARD",
  9: "SET_CLIPBOARD",
  10: "SET_DISPLAY_POWER",
  11: "ROTATE_DEVICE",
  12: "UHID_CREATE",
  13: "UHID_INPUT",
  14: "UHID_DESTROY",
  15: "OPEN_HARD_KEYBOARD_SETTINGS",
  16: "START_APP",
  17: "RESET_VIDEO",
  18: "CAMERA_SET_TORCH",
  19: "CAMERA_ZOOM_IN",
  20: "CAMERA_ZOOM_OUT",
  21: "RESIZE_DISPLAY",
  101: "CHANGE_STREAM_PARAMETERS",
};

const MOTION_ACTION_NAMES = {
  0: "DOWN",
  1: "UP",
  2: "MOVE",
  7: "HOVER_MOVE",
  9: "HOVER_ENTER",
  10: "HOVER_EXIT",
};

function toBuffer(data) {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  return Buffer.from(data);
}

function startsWithMagic(buffer, magic) {
  return buffer.length >= magic.length && buffer.subarray(0, magic.length).equals(magic);
}

/** Match WsControlFilter.looksLikeAnnexB — only at payload start, not inside touch coords. */
function startsWithAnnexB(buffer) {
  if (buffer.length < 3) {
    return false;
  }

  if (buffer[0] !== 0x00 || buffer[1] !== 0x00) {
    return false;
  }

  if (buffer[2] === 0x01) {
    return true;
  }

  return buffer.length >= 4 && buffer[2] === 0x00 && buffer[3] === 0x01;
}

function isKnownControlType(type) {
  return CONTROL_TYPE_NAMES[type] !== undefined;
}

function summarizeTouch(buffer) {
  if (buffer.length < 32) {
    return {
      controlType: "INJECT_TOUCH_EVENT",
      touchBytes: buffer.length,
      touchFormat: buffer.length === 28 ? "ws-scrcpy-legacy-28" : "short",
    };
  }

  return {
    controlType: "INJECT_TOUCH_EVENT",
    action: MOTION_ACTION_NAMES[buffer[1]] ?? buffer[1],
    pointerId: buffer.readBigInt64BE(2).toString(),
    x: buffer.readInt32BE(10),
    y: buffer.readInt32BE(14),
    screenW: buffer.readUInt16BE(18),
    screenH: buffer.readUInt16BE(20),
    pressure: Math.round((buffer.readUInt16BE(22) / 0xffff) * 1000) / 1000,
    actionButton: buffer.readUInt32BE(24),
    buttons: buffer.readUInt32BE(28),
    touchFormat: "scrcpy-4.0-32",
  };
}

/**
 * Extract new_display / start_app from type-101 codec extras for multi-app diagnosis.
 * Layout matches serializeVideoSettings (body) with a leading control type byte.
 * @param {Buffer} buffer full control frame including leading type byte
 */
function summarizeChangeStreamParameters(buffer) {
  const out = {};
  // type(1) + base VideoSettings(35) = 36 minimum before optional strings
  if (buffer.length < 36) {
    return out;
  }

  try {
    const width = buffer.readUInt16BE(10);
    const height = buffer.readUInt16BE(12);
    const displayId = buffer.readInt32BE(24);
    out.bitRate = buffer.readInt32BE(1);
    out.maxFps = buffer.readInt32BE(5);
    out.iFrameInterval = buffer.readInt8(9);
    out.bounds = `${width}x${height}`;
    out.displayId = displayId;
    out.sendFrameMeta = buffer.readInt8(22);
    out.lockedOrientation = buffer.readInt8(23);

    const codecLen = buffer.readUInt32BE(28);
    if (codecLen > 0 && buffer.length >= 32 + codecLen) {
      const extras = buffer.subarray(32, 32 + codecLen).toString("utf8");
      const newDisplay = extras.match(/(?:^|,)new_display=([^,]*)/)?.[1];
      const startApp = extras.match(/(?:^|,)start_app=([^,]*)/)?.[1];
      if (newDisplay != null) {
        out.newDisplay = newDisplay;
      }
      if (startApp) {
        out.startApp = startApp;
      }
      out.extrasLen = codecLen;
      out.extras = extras.slice(0, 160);
    }

    const encoderLenOff = 32 + codecLen;
    if (buffer.length >= encoderLenOff + 4) {
      const encLen = buffer.readUInt32BE(encoderLenOff);
      if (encLen > 0 && buffer.length >= encoderLenOff + 4 + encLen) {
        out.encoderName = buffer.subarray(encoderLenOff + 4, encoderLenOff + 4 + encLen).toString("utf8");
      }
      out.encoderLen = encLen;
    }
  } catch {
    // ignore parse errors
  }

  return out;
}

/**
 * @param {Buffer | ArrayBuffer | ArrayBufferView} data
 */
export function summarizeWsPacket(data) {
  const buffer = toBuffer(data);
  const size = buffer.length;

  if (!size) {
    return { kind: "empty", size: 0 };
  }

  if (startsWithMagic(buffer, MAGIC_INITIAL)) {
    return { kind: "scrcpy_initial", size };
  }

  if (startsWithMagic(buffer, MAGIC_MESSAGE)) {
    return { kind: "scrcpy_message", size };
  }

  if (startsWithMagic(buffer, MAGIC_AUDIO)) {
    return { kind: "scrcpy_audio", size };
  }

  if (startsWithAnnexB(buffer)) {
    return { kind: "video_annexb", size };
  }

  const type = buffer[0];

  if (type === 2) {
    return { kind: "control", size, ...summarizeTouch(buffer) };
  }

  if (isKnownControlType(type)) {
    const typeName = CONTROL_TYPE_NAMES[type];
    const summary = { kind: "control", size, controlType: typeName };

    if (type === 0 && size >= 14) {
      summary.keyAction = buffer[1];
      summary.keycode = buffer.readUInt32BE(2);
    }

    if (type === 10 && size >= 2) {
      summary.powerMode = buffer[1];
    }

    if (type === 12 && size >= 3) {
      summary.uhidId = buffer.readUInt16BE(1);
    }

    if (type === 13 && size >= 5) {
      summary.uhidId = buffer.readUInt16BE(1);
      summary.uhidInputSize = buffer.readUInt16BE(3);
    }

    if (type === 14 && size >= 3) {
      summary.uhidId = buffer.readUInt16BE(1);
    }

    if (type === 16 && size >= 3) {
      const nameLen = buffer.readUInt16BE(1);
      if (nameLen > 0 && size >= 3 + nameLen) {
        summary.startApp = buffer.subarray(3, 3 + nameLen).toString("utf8");
      }
    }

    if (type === 101) {
      Object.assign(summary, summarizeChangeStreamParameters(buffer));
    }

    return summary;
  }

  return { kind: "unknown", size, firstByte: type };
}

export function shouldLogPacketSummary(summary, counters, direction) {
  if (summary.kind === "video_annexb") {
    const key = direction === "client_to_remote" ? "clientVideo" : "remoteVideo";
    counters[key] = (counters[key] ?? 0) + 1;
    const count = counters[key];

    return count <= 2 || count % 400 === 0;
  }

  if (summary.kind === "scrcpy_audio") {
    const key = direction === "client_to_remote" ? "clientAudio" : "remoteAudio";
    counters[key] = (counters[key] ?? 0) + 1;
    const count = counters[key];

    return count <= 2 || count % 200 === 0;
  }

  if (summary.controlType === "UHID_INPUT") {
    const key = `${direction}:uhid_input`;
    counters[key] = (counters[key] ?? 0) + 1;
    const count = counters[key];

    return count <= 2 || count % 120 === 0;
  }

  if (summary.controlType === "INJECT_TEXT") {
    const key = `${direction}:inject_text`;
    counters[key] = (counters[key] ?? 0) + 1;
    const count = counters[key];

    return count <= 3 || count % 40 === 0;
  }

  return true;
}
