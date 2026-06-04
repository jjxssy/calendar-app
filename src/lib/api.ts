export type SessionUser = {
  id?: string;
  email: string;
  name?: string;
};

export type AppSession = {
  accessToken?: string;
  user: SessionUser;
  remember?: boolean;
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

export function saveSession(session: AppSession, remember = true) {
  if (typeof window === "undefined") return;

  const sessionToSave: AppSession = {
    ...session,
    remember,
  };

  if (remember) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionToSave));
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionToSave));
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export function readSession() {
  if (typeof window === "undefined") return null;

  const raw =
    window.localStorage.getItem(SESSION_STORAGE_KEY) ??
    window.sessionStorage.getItem(SESSION_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_SESSION_STORAGE_KEY) ??
    window.sessionStorage.getItem(LEGACY_SESSION_STORAGE_KEY);

  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AppSession;
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export async function logout(redirectTo = "/login") {
  try {
    const { createClient } = await import("@/utils/supabase/client");
    await createClient().auth.signOut();
  } finally {
    clearSession();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("arcgenda-theme");
      window.location.replace(redirectTo);
    }
  }
}
