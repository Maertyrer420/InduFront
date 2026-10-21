import { ClientEnv } from "./ClientEnv";

// The account/shop API origin (api.<audience>). Lives apart from Api.ts so
// modules that Api.ts itself depends on (ServerList) can reach it without an
// import cycle; Api.ts re-exports both for its existing importers.

function pageOrigin(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  const { origin } = window.location;
  return typeof origin === "string" && origin.startsWith("http")
    ? origin
    : null;
}

export function getApiBase() {
  if (typeof localStorage !== "undefined") {
    const override = localStorage.getItem("apiHost");
    if (override) return override;
  }
  const apiDomain =
    typeof process !== "undefined" ? process.env?.API_DOMAIN : undefined;
  if (apiDomain) return `https://${apiDomain}`;

  const origin = pageOrigin();
  let domainname: string | null;
  try {
    domainname = getAudience();
  } catch {
    // No bootstrap config (yet): the page's own origin is the only answer.
    domainname = null;
  }
  // Single-service hosting (Render, local dev, tunnels): the page's own
  // hostname IS the JWT audience and no api.<domain> subdomain exists, so the
  // auth server is reached through the page's own /idp path.
  if (
    origin !== null &&
    (domainname === null ||
      domainname === "localhost" ||
      window.location.hostname === domainname)
  ) {
    return `${origin}/idp`;
  }
  if (domainname === null || domainname === "localhost") {
    return "http://localhost:8787";
  }
  return `https://api.${domainname}`;
}

export function getAudience() {
  // Sourced from BOOTSTRAP_CONFIG (server/desktop-injected) rather than
  // window.location, so the desktop app (app://openfront) targets real infra.
  return ClientEnv.jwtAudience();
}
