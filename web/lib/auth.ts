// There's no password/session system on the backend — "signed in" means
// "the browser is holding a valid API key" (see the backend's own
// ownerLabel-is-the-account model). This is the one place that key ever
// touches storage: localStorage, on this device only.
const STORAGE_KEY = "shui-wg-api-key";

export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
