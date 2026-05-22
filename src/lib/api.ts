export type SessionUser = {
  id?: string;
  email: string;
  name?: string;
};

export type AppSession = {
  accessToken?: string;
  user: SessionUser;
};

const SESSION_STORAGE_KEY = "arcgenda-session";
const LEGACY_SESSION_STORAGE_KEY = "luma-calendar-session";
const DATA_STORAGE_PREFIX = "arcgenda-data";
const LEGACY_DATA_STORAGE_PREFIX = "luma-calendar-data";

export async function syncCurrentUser() {
  const response = await fetch("/api/users/me", {
    method: "POST",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not sync user profile");
  }

  return response.json() as Promise<{ user: SessionUser }>;
}

export function saveSession(session: AppSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export function readSession() {
  const raw = readSessionSnapshot();
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AppSession;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    return session;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    return null;
  }
}

export function readSessionSnapshot() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem(SESSION_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_SESSION_STORAGE_KEY)
  );
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export function sessionStorageKey(session: AppSession) {
  return `${DATA_STORAGE_PREFIX}:${session.user.id ?? session.user.email}`;
}

export function legacySessionStorageKey(session: AppSession) {
  return `${LEGACY_DATA_STORAGE_PREFIX}:${session.user.id ?? session.user.email}`;
}
