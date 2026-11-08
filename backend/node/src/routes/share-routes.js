import { APP_VERSION } from "../config/version.js";
import {
  SHARE_TTL_DEFAULT_MINUTES,
  SHARE_TTL_MAX_MINUTES,
  ShareTokenError,
  createShareToken,
  listShareTokens,
  revokeShareToken,
} from "../services/share-tokens.js";
import { readProtectedJsonBody, sendProtectedJson } from "../utils/protected-http.js";

const SHARE_ITEM_PATH = /^\/api\/share\/([^/]+)$/;

/**
 * 只读分享链接管理（仅管理员会话可达；viewer 在 app.js 的入口闸门上就被挡掉了）。
 */
export async function handleShareRoute(req, res, method, pathname) {
  if (method === "GET" && pathname === "/api/share") {
    sendProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
      items: listShareTokens(),
      defaultTtlMinutes: SHARE_TTL_DEFAULT_MINUTES,
      maxTtlMinutes: SHARE_TTL_MAX_MINUTES,
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/share") {
    try {
      const body = Number(req.headers["content-length"] ?? 0) > 0
        ? (await readProtectedJsonBody(req, res)) ?? {}
        : {};
      const { token, share } = createShareToken({
        label: body.label,
        ttlMinutes: body.ttlMinutes,
      });

      // 明文令牌只在这里出现一次：管理员复制走后服务端只留哈希
      sendProtectedJson(res, 201, {
        success: true,
        version: APP_VERSION,
        token,
        share,
        redeemPath: "/share",
      });
    } catch (error) {
      sendProtectedJson(res, error instanceof ShareTokenError ? error.statusCode : 400, {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "share_create_failed",
        message: error instanceof Error ? error.message : "创建分享链接失败。",
      });
    }

    return true;
  }

  const revokeMatch = pathname.match(SHARE_ITEM_PATH);
  if (method === "DELETE" && revokeMatch) {
    const id = decodeURIComponent(revokeMatch[1]);
    const revoked = revokeShareToken(id);

    sendProtectedJson(res, revoked ? 200 : 404, {
      success: revoked,
      version: APP_VERSION,
      id,
      error: revoked ? undefined : "share_not_found",
      message: revoked ? undefined : "分享链接不存在或已过期。",
    });
    return true;
  }

  return false;
}
