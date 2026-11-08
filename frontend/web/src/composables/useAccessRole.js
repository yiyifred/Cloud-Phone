import { computed, reactive } from "vue";

import { fetchAccessRole } from "../utils/share-api.js";
import { logInfo, logWarn } from "../utils/app-event-logger.js";

/**
 * 全局访问角色（admin / viewer / unknown）。
 *
 * 为什么放在模块级单例而不是每个组件各自请求：
 * 角色是「整个控制台一次性的事实」——横幅、设备画廊、工作区工具栏、设置页
 * 都要读同一个值；每个组件各自 GET /api/access 既浪费又会出现瞬时不一致
 * （横幅已经显示只读、按钮还是可点的）。这里用一个 reactive 单例，启动时查一次，
 * 之后靠 refresh() 显式刷新即可。
 */
const state = reactive({
  role: "unknown",
  readOnly: false,
  ready: false,
});

export async function refreshAccessRole() {
  try {
    const access = await fetchAccessRole();

    if (state.role !== access.role) {
      logInfo("auth", "access.role", `访问角色：${access.role}`);
    }

    state.role = access.role;
    state.readOnly = access.readOnly;

    return { ...access };
  } catch (error) {
    // 查不到角色不等于管理员：宁可保持 unknown（不显示只读横幅，但写操作会自己撞 401/403），
    // 也不能把 viewer 误判成 admin。
    state.role = "unknown";
    state.readOnly = false;
    logWarn("auth", "access.role.failed", "查询访问角色失败", {
      details: { error: error instanceof Error ? error.message : String(error ?? "") },
    });

    return { role: "unknown", readOnly: false };
  } finally {
    state.ready = true;
  }
}

/**
 * 把 authState 切成「已登录的 viewer 会话」。
 * 分享访问没有管理员会话，但控制台壳的判断条件只有 authenticated——
 * 这里集中一处改写，避免在 AppShell 里散落三行赋值。
 */
export function markViewerSession(authState) {
  if (!authState) {
    return;
  }

  authState.authenticated = true;
  authState.requiresPasswordChange = false;
  authState.booting = false;
}

export function useAccessRole() {
  return {
    role: computed(() => state.role),
    readOnly: computed(() => state.readOnly),
    ready: computed(() => state.ready),
    refresh: refreshAccessRole,
  };
}
