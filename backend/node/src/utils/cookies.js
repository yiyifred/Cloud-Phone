/**
 * Cookie parsing must never throw: a single malformed percent-escape used to
 * blow up inside the request handler before any response was written, leaving
 * the connection hanging until the client timed out.
 */
export function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce((cookies, entry) => {
    const [rawName, ...rawValueParts] = entry.trim().split("=");

    if (!rawName) {
      return cookies;
    }

    const rawValue = rawValueParts.join("=");

    try {
      cookies[rawName] = decodeURIComponent(rawValue);
    } catch {
      cookies[rawName] = rawValue;
    }

    return cookies;
  }, {});
}
