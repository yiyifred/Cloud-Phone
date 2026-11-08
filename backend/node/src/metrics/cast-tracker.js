/**
 * harmony / ios 的投屏会话只在路由层建立与结束，而它们的 session store 只提供
 * 「按 serial 取会话」，没有枚举接口，采集时算不出总数。
 * 这里用「操作前后读同一份真值」的方式记账，而不是在每个分支手写 +1/-1：
 * 重复 start、start 抛错、stop 一个本来就不存在的会话都不会把计数带偏。
 */

import { getHarmonyCastSession } from "../services/harmony-cast/session-store.js";
import { getIosCastSession } from "../services/ios-cast/session-store.js";
import { noteNonScrcpyCastSession } from "./definitions.js";

const SESSION_READERS = {
  harmony: getHarmonyCastSession,
  ios: getIosCastSession,
};

/**
 * @template T
 * @param {"harmony" | "ios"} platform
 * @param {string} serial
 * @param {() => Promise<T>} operation
 * @returns {Promise<T>}
 */
export async function withCastSessionTracking(platform, serial, operation) {
  const read = SESSION_READERS[platform];

  if (!read) {
    return operation();
  }

  const existedBefore = Boolean(read(serial));

  try {
    return await operation();
  } finally {
    // finally 里记账：start 之后才抛错的会话也算「已建立」，否则计数会永久偏低
    const existsAfter = Boolean(read(serial));
    noteNonScrcpyCastSession(Number(existsAfter) - Number(existedBefore));
  }
}
