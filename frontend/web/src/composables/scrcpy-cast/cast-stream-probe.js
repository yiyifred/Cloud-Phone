/**
 * 视频流二进制帧的识别与设备错误文案归一（T-433 从 useDeviceScrcpyCast 抽出）。
 *
 * 为什么单独放：这两段都是「纯判断」，不含连接状态，抽出来可以单独验证——
 * 首帧 sniff 一旦写错，表现为 beginCast 永远不返回（多开窗口卡在 loading 遮罩），
 * 很难在联调里定位，所以让它保持小而可测。
 */
import {
  formatVirtualDisplayUserMessage,
  isVirtualDisplayError,
} from "../../utils/cast-error-message.js";

/**
 * 判断一帧二进制数据是否已经是视频流（而不是握手期的控制回包）。
 *
 * 原理：scrcpy 的视频包以 12 字节帧头开头，前 4 字节是 PTS 高 32 位；
 * 新协议的视频包以 0x00 0x00 0x01 起始，旧协议用 0x00 0x00 0x00 0x01。
 * 只看前 4 字节就够——真正的解码交给 player，这里只为「流已活」这个事实。
 */
export function isVideoStreamStart(data) {
  if (!(data instanceof ArrayBuffer || ArrayBuffer.isView(data))) {
    return false;
  }

  const head = new Uint8Array(
    data instanceof ArrayBuffer ? data : data.buffer,
    data instanceof ArrayBuffer ? 0 : data.byteOffset,
    Math.min(8, data.byteLength),
  );

  return (
    head.length >= 4 &&
    head[0] === 0x00 &&
    head[1] === 0x00 &&
    (head[2] === 0x01 || (head[2] === 0x00 && head[3] === 0x01))
  );
}

/**
 * 把设备回报的错误码/信息翻成用户能看懂的一句。
 * 虚拟显示（多开）失败的后端文案是给开发看的，必须替换成带操作建议的版本。
 */
export function formatCastErrorForUser(castError) {
  const raw = castError?.message || castError?.code;
  return isVirtualDisplayError(raw)
    ? formatVirtualDisplayUserMessage(castError?.message)
    : castError?.message || "投屏失败";
}
