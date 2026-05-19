export type SessionUser = {
  id?: string;
  email: string;
  name?: string;
};

export type AppSession = {
  accessToken?: string;
  user: SessionUser;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function authRequest(
  path: "/auth/login" | "/auth/register",
  body: Record<string, string>,
) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Authentication failed");
  }

  return (await response.json()) as AppSession;
}

export function saveSession(session: AppSession) {
  localStorage.setItem("luma-calendar-session", JSON.stringify(session));
}

export function readSession() {
  const raw = localStorage.getItem("luma-calendar-session");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AppSession;
  } catch {
    localStorage.removeItem("luma-calendar-session");
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("luma-calendar-session");
}

export function sessionStorageKey(session: AppSession) {
  return `luma-calendar-data:${session.user.id ?? session.user.email}`;
}
