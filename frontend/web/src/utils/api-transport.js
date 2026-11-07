let preferredApiRoute = null; // "proxy" | "direct"

function buildLanBackendUrl(url) {
  if (typeof window === "undefined" || typeof url !== "string" || !url.startsWith("/api/")) {
    return null;
  }

  // Backend listens on plain HTTP. HTTPS pages cannot call http://:3000 (mixed content),
  // and the backend does not serve TLS on :3000.
  if (window.location.protocol === "https:") {
    return null;
  }

  const hostname = window.location.hostname;

  if (!hostname) {
    return null;
  }

  return `http://${hostname}:3000${url}`;
}

function resolveApiUrlByRoute(url, route) {
  if (route === "direct") {
    return buildLanBackendUrl(url) ?? url;
  }
  return url;
}

export async function fetchWithLanFallback(url, options) {
  const onViteDev =
    typeof window !== "undefined" &&
    window.location.port !== "" &&
    String(window.location.port) !== "3000";
  const primaryRoute = preferredApiRoute ?? "proxy";
  const secondaryRoute = primaryRoute === "proxy" ? "direct" : "proxy";
  const primaryUrl = resolveApiUrlByRoute(url, primaryRoute);

  try {
    const response = await fetch(primaryUrl, options);
    preferredApiRoute = primaryRoute;
    return response;
  } catch (error) {
    const fallbackUrl = resolveApiUrlByRoute(url, secondaryRoute);

    if (
      !(error instanceof TypeError) ||
      !fallbackUrl ||
      fallbackUrl === primaryUrl ||
      (onViteDev && secondaryRoute === "direct")
    ) {
      throw error;
    }

    const response = await fetch(fallbackUrl, options);
    preferredApiRoute = secondaryRoute;
    return response;
  }
}
