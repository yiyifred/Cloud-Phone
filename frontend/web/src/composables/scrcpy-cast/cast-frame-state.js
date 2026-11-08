/**
 * 画面尺寸与首帧状态（T-433 从 useDeviceScrcpyCast 抽出）。
 *
 * 为什么独立于连接与 UI：这三个函数同时被两条路径调用——
 * (1) player 回调（首帧渲染、视频帧尺寸变化）；(2) 交互层（attachCastInteraction
 * 每次触摸都要问当前画面尺寸）。放在这里两边都能拿到同一份 screenSize，
 * 又不必让 player 回调去依赖 session 模块，避免循环依赖。
 */
export function createCastFrameState({ ctx, startup }) {
  function markFirstFrameRendered() {
    // openWebSocketReady 是「首帧已到」的软就绪信号：解析它之后 beginCast 才返回，
    // 但后续帧仍会继续进来（见 openWebSocket 里的 fallback 说明）。
    ctx.openWebSocketReady?.();

    if (!ctx.showStartupLogs.value) {
      return;
    }
    const size = ctx.screenSize.value;
    if (size.width > 0 && size.height > 0) {
      startup.append(`视频尺寸 ${size.width} × ${size.height}`);
    }
    startup.append("首帧已渲染");
    startup.hide();
  }

  function applyControlVideoSize(size) {
    if (!size?.width || !size?.height) {
      return;
    }

    // 尺寸没变就不写 ref：交互层 watch 这个值，无谓的赋值会让触摸映射重算。
    if (
      ctx.screenSize.value.width === size.width &&
      ctx.screenSize.value.height === size.height
    ) {
      return;
    }

    ctx.screenSize.value = { width: size.width, height: size.height };
  }

  function getEffectiveScreenSize() {
    if (ctx.screenSize.value.width > 0 && ctx.screenSize.value.height > 0) {
      return ctx.screenSize.value;
    }

    return { width: 0, height: 0 };
  }

  return { markFirstFrameRendered, applyControlVideoSize, getEffectiveScreenSize };
}
