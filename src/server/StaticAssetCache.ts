const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const NO_CACHE_CONTROL = "no-cache, no-store, must-revalidate, max-age=0";

function stripQueryString(urlPath: string): string {
  return urlPath.split("?", 1)[0];
}

export function getStaticAssetCacheControl(
  urlPath: string | undefined,
): string | undefined {
  if (!urlPath) {
    return undefined;
  }

  const normalizedPath = stripQueryString(urlPath);
  if (
    normalizedPath.startsWith("/assets/") ||
    normalizedPath.startsWith("/_assets/")
  ) {
    return IMMUTABLE_CACHE_CONTROL;
  }

  if (
    normalizedPath.endsWith(".html") ||
    normalizedPath === "/" ||
    normalizedPath === "/terms.html" ||
    normalizedPath === "/privacy.html" ||
    normalizedPath === "/terms-of-service.html" ||
    normalizedPath === "/privacy-policy.html"
  ) {
    return NO_CACHE_CONTROL;
  }

  return undefined;
}

export function applyStaticAssetCacheControl(
  setHeader: (name: string, value: string) => void,
  urlPath: string | undefined,
): void {
  const cacheControl = getStaticAssetCacheControl(urlPath);
  if (cacheControl) {
    setHeader("Cache-Control", cacheControl);
  }
}
