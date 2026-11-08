/**
 * 配对结果文案拼装（T-430 从 AddDeviceModal 抽出）。
 *
 * 配对码与二维码两条路径、成功与异常两种结局，一共四处都要产出同一个
 * `{ok, message, connectOk, connectMessage}` 形状；放在这里保证它们不会各写一套、
 * 也不会出现「配对失败但连接提示还是成功」这种漂移。
 */
export function formatPairConnectMessage(connect, translate) {
  if (!connect) {
    return translate("devices.addDeviceModal.pairCode.connectSkipped");
  }

  if (connect.success) {
    return (
      connect.connectedEndpoint ||
      connect.attempts?.find((item) => item.ok)?.endpoint ||
      translate("devices.addDeviceModal.pairCode.connectSuccess")
    );
  }

  const failedAttempt = connect.attempts?.find((item) => !item.ok && item.output);
  return failedAttempt?.output || translate("devices.addDeviceModal.pairCode.connectFailed");
}

export function formatPairMessage(result, translate) {
  return (
    result?.pair?.output ||
    result?.message ||
    translate("devices.addDeviceModal.pairCode.pairSuccess")
  );
}

export function buildPairResult(result, translate) {
  return {
    ok: Boolean(result?.success),
    message: formatPairMessage(result, translate),
    connectOk: Boolean(result?.connect?.success),
    connectMessage: formatPairConnectMessage(result?.connect, translate),
  };
}

export function buildPairFailure(message, translate) {
  return {
    ok: false,
    message,
    connectOk: false,
    connectMessage: translate("devices.addDeviceModal.pairCode.connectSkipped"),
  };
}
