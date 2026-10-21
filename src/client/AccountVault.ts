export const INDUFRONT_VAULT_KEY = "indufront_vault_token";

export function getLocalVaultToken(): string | null {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(INDUFRONT_VAULT_KEY)
      : null;
  } catch {
    return null;
  }
}

export function saveLocalVaultToken(
  vaultToken: string | undefined | null,
): void {
  if (!vaultToken || typeof vaultToken !== "string") return;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(INDUFRONT_VAULT_KEY, vaultToken);
    }
  } catch {
    /* ignore storage errors */
  }
}
