import { ClientEnv } from "./ClientEnv";

// The account/shop API origin (api.<audience>). Lives apart from Api.ts so
// modules that Api.ts itself depends on (ServerList) can reach it without an
// import cycle; Api.ts re-exports both for its existing importers.

export function getApiBase() {
  if (typeof localStorage !== "undefined") {
    const override = localStorage.getItem("apiHost");
    if (override) return override;
  }
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.origin}/idp`;
  }
  return "http://localhost:8787";
}

export function getAudience() {
  // Sourced from BOOTSTRAP_CONFIG (server/desktop-injected) rather than
  // window.location, so the desktop app (app://openfront) targets real infra.
  return ClientEnv.jwtAudience();
}
