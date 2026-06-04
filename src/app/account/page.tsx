"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Save, Shield, UserRound } from "lucide-react";
import { readSession, saveSession, syncCurrentUser } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BrandMark } from "@/components/brand/brand-mark";
import { LogoutButton } from "@/components/auth/logout-button";

type AccountUser = {
  id?: string;
  email: string;
  name?: string | null;
  theme?: "light" | "dark" | "system";
};

function AccountSettingsContent() {
  const [user, setUser] = useState<AccountUser | null>(() => readSession()?.user ?? null);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<AccountUser["theme"]>("light");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token ?? readSession()?.accessToken;
        const { user: syncedUser } = await syncCurrentUser(accessToken);
        const response = await fetch(`/api/users/me?_=${Date.now()}`, {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load account settings.");
        }

        const nextUser = payload.user as AccountUser;
        saveSession({ accessToken, user: syncedUser }, Boolean(readSession()));

        if (!active) return;
        setUser(nextUser);
        setName(nextUser.name ?? "");
        setTheme(nextUser.theme ?? "light");
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load account settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAccount();

    return () => {
      active = false;
    };
  }, []);

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const accessToken = readSession()?.accessToken;
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ name, theme }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save account settings.");
      }

      const updated = payload.user as AccountUser;
      setUser(updated);
      setName(updated.name ?? "");
      setTheme(updated.theme ?? "light");

      const current = readSession();
      if (current) {
        saveSession(
          {
            ...current,
            user: {
              id: updated.id,
              email: updated.email,
              name: updated.name ?? undefined,
            },
          },
          current.remember ?? true,
        );
      }

      window.localStorage.setItem("arcgenda-theme", updated.theme ?? "light");
      document.documentElement.dataset.theme = updated.theme ?? "light";
      document.documentElement.classList.toggle("dark", updated.theme === "dark");
      setMessage("Account settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save account settings.");
    } finally {
      setSaving(false);
    }
  }


  return (
    <main className="min-h-dvh overflow-hidden bg-[#f6f4ff] px-5 py-5 text-[#18181b]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-80px] size-72 rounded-full bg-[#ff9bd2]/45 blur-3xl" />
        <div className="absolute right-[-90px] top-28 size-72 rounded-full bg-[#7dd3fc]/50 blur-3xl" />
        <div className="absolute bottom-[-120px] left-12 size-80 rounded-full bg-[#fef08a]/40 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BrandMark size="md" />
          <Link href="/calendar" className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-[#007aff] shadow-lg shadow-black/5">
            <ArrowLeft size={16} /> Back to calendar
          </Link>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-[34px] border border-white/70 bg-white/78 p-6 shadow-2xl shadow-[#6d5dfc]/12 backdrop-blur-3xl">
            <div className="grid size-16 place-items-center rounded-3xl bg-[#007aff] text-white shadow-lg shadow-[#007aff]/25">
              <UserRound size={29} />
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-normal">Account settings</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#636366]">
              Manage your profile, theme preference, session, and security controls for Arcgenda.
            </p>

            <div className="mt-6 space-y-3 text-sm font-bold text-[#636366]">
              <div className="flex items-center gap-3 rounded-3xl bg-white/74 p-3 shadow-sm shadow-black/5">
                <Shield className="text-[#34c759]" size={18} /> Protected page, login required
              </div>
              <div className="flex items-center gap-3 rounded-3xl bg-white/74 p-3 shadow-sm shadow-black/5">
                <CalendarDays className="text-[#af52de]" size={18} /> Calendar workspace stays private
              </div>
            </div>
          </aside>

          <section className="rounded-[34px] border border-white/70 bg-white/78 p-6 shadow-2xl shadow-[#6d5dfc]/12 backdrop-blur-3xl">
            {loading ? (
              <div className="py-16 text-center">
                <div className="mx-auto size-12 animate-pulse rounded-3xl bg-[#007aff]/20" />
                <p className="mt-4 text-sm font-black text-[#636366]">Loading your account...</p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={saveAccount}>
                <div>
                  <label className="text-sm font-black text-[#636366]">Email</label>
                  <input className="input-shell mt-2 w-full opacity-70" value={user?.email ?? ""} disabled />
                </div>
                <div>
                  <label className="text-sm font-black text-[#636366]">Display name</label>
                  <input
                    className="input-shell mt-2 w-full"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-[#636366]">Theme</label>
                  <select
                    className="input-shell mt-2 w-full"
                    value={theme ?? "light"}
                    onChange={(event) => setTheme(event.target.value as AccountUser["theme"])}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">Use system</option>
                  </select>
                </div>

                {message && <p className="text-sm font-semibold text-[#34c759]">{message}</p>}
                {error && <p className="text-sm font-semibold text-[#ff3b30]">{error}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25 disabled:opacity-60"
                >
                  <Save size={18} /> {saving ? "Saving..." : "Save account settings"}
                </button>
              </form>
            )}

            <div className="mt-6 rounded-[28px] bg-[#fff0f0] p-4">
              <h2 className="text-lg font-black text-[#ff3b30]">Session</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#7c7c8a]">
                Logging out removes the saved app session from this browser and returns you to the login page.
              </p>
              <div className="mt-4">
                <LogoutButton />
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default function AccountSettingsPage() {
  return (
    <ProtectedRoute>
      <AccountSettingsContent />
    </ProtectedRoute>
  );
}
