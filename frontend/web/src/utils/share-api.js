import { requestJson } from "./api.js";

/**
 * 只读分享（viewer）相关接口。
 *
 * 为什么单独一个模块：这些接口和「管理员会话」是两套凭据——
 * 管理分享链接要管理员会话（viewer 调会 403），而 /api/access 恰恰是
 * 浏览器用来判断「我现在到底是什么角色」的唯一入口，调用方式也不同
 * （必须以 skipAuthExpire 调，未登录是正常情况，不是会话过期）。
 */

/** 有效期选项（小时）：固定几档，避免用户填出「30 天」这类超出预期的时间窗。 */
export const SHARE_TTL_HOURS = [1, 8, 24, 72];

/**
 * 分享链接 = 后端落地页地址，浏览器访问后由后端种 HttpOnly cookie 再 302 回控制台。
 * 用当前 origin 而不是后端地址：前端 dev server 已把 /api 代理过去，
 * 复制出去的链接因此和用户当下访问的地址一致（局域网 IP / 反代域名都对）。
 */
export function buildShareLink(token) {
  const value = String(token ?? "");

  if (!value) {
    return "";
  }

  return `${window.location.origin}/api/share/redeem?token=${encodeURIComponent(value)}`;
}

/** 创建分享链接；明文 token 只在这里出现一次，调用方必须立刻展示给用户。 */
export async function createShareLink({ label, ttlMinutes } = {}) {
  const result = await requestJson("/api/share", {
    method: "POST",
    body: {
      label: String(label ?? "").trim(),
      ttlMinutes: Number(ttlMinutes) || 0,
    },
  });

  return {
    token: result.token,
    share: result.share ?? null,
    link: buildShareLink(result.token),
  };
}

/**
 * 列出分享链接。allowFailure + skipAuthExpire：未登录或 viewer 都会得到
 * 非 2xx，这属于「没权限」而不是「会话过期」，不能触发全局登出流程。
 */
export async function fetchShareLinks() {
  const result = await requestJson("/api/share", {
    method: "GET",
    allowFailure: true,
    skipAuthExpire: true,
  });

  if (!result?.success) {
    return {
      denied: true,
      items: [],
      defaultTtlMinutes: null,
      maxTtlMinutes: null,
      message: String(result?.message ?? ""),
    };
  }

  return {
    denied: false,
    items: Array.isArray(result.items) ? result.items : [],
    defaultTtlMinutes: result.defaultTtlMinutes ?? null,
    maxTtlMinutes: result.maxTtlMinutes ?? null,
    message: "",
  };
}

/** 吊销：后端返回 success=false 表示已经不存在（过期会被顺手清掉），照实回传。 */
export async function revokeShareLink(id) {
  const result = await requestJson(`/api/share/${encodeURIComponent(String(id ?? ""))}`, {
    method: "DELETE",
    allowFailure: true,
    skipAuthExpire: true,
  });

  return {
    ok: Boolean(result?.success),
    message: String(result?.message ?? ""),
  };
}

/**
 * 查询当前浏览器凭据的访问角色。
 * 401 = 匿名（该去登录），200 且 role=viewer = 只读分享，200 且 role=admin = 管理员。
 */
export async function fetchAccessRole() {
  const result = await requestJson("/api/access", {
    method: "GET",
    allowFailure: true,
    skipAuthExpire: true,
  });

  const role =
    result?.role === "viewer" ? "viewer" : result?.role === "admin" ? "admin" : "unknown";

  // 只有 viewer 是只读；匿名（unknown）不是只读，而是「还没登录」，由登录流程接管
  return {
    role,
    readOnly: role === "viewer",
  };
}
