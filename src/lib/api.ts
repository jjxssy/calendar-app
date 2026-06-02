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

export async function syncCurrentUser(accessToken?: string) {
  const response = await fetch("/api/users/me", {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
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
  if (typeof window === "undefined") return null;
  const raw =
    localStorage.getItem(SESSION_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
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

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}
