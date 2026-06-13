"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  EyeOff,
  LockKeyhole,
  Save,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
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
  plan?: "free" | "premium";
  premium?: boolean;
};

function PlanPreviewCard({
  title,
  label,
  children,
  highlighted = false,
}: {
  title: string;
  label: string;
  children: string;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`rounded-[28px] border p-4 shadow-lg shadow-black/5 ${
        highlighted
          ? "border-[#007aff]/25 bg-[#eaf4ff]"
          : "border-white/70 bg-white/76"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-[#18181b]">{title}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${
            highlighted
              ? "bg-[#007aff] text-white"
              : "bg-[#f2f2f7] text-[#636366]"
          }`}
        >
          {label}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#636366]">
        {children}
      </p>
    </article>
  );
}

function AccountSettingsContent() {
  const searchParams = useSearchParams();
  const resetMode = searchParams.get("mode") === "reset-password";

  const [user, setUser] = useState<AccountUser | null>(
    () => readSession()?.user ?? null,
  );
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<AccountUser["theme"]>("light");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const isPremium = user?.premium === true || user?.plan === "premium";

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const accessToken =
          data.session?.access_token ?? readSession()?.accessToken;

        const { user: syncedUser } = await syncCurrentUser(accessToken);

        const response = await fetch(`/api/users/me?_=${Date.now()}`, {
          cache: "no-store",
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load account settings.");
        }

        const nextUser = payload.user as AccountUser;

        saveSession(
          { accessToken, user: syncedUser },
          readSession()?.remember ?? true,
        );

        if (!active) return;

        setUser(nextUser);
        setName(nextUser.name ?? "");
        setTheme(nextUser.theme ?? "light");
      } catch (loadError) {
        if (!active) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load account settings.",
        );
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
      document.documentElement.classList.toggle(
        "dark",
        updated.theme === "dark",
      );

      setMessage("Account settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save account settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordSaving) return;

    setPasswordMessage("");
    setPasswordError("");

    const accountEmail = user?.email ?? readSession()?.user.email;

    if (!accountEmail) {
      setPasswordError("Could not find your account email.");
      return;
    }

    if (!resetMode && !currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (!resetMode && currentPassword === newPassword) {
      setPasswordError("New password must be different from the current password.");
      return;
    }

    setPasswordSaving(true);

    try {
      const supabase = createClient();

      if (!resetMode) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: accountEmail,
          password: currentPassword,
        });

        if (loginError) {
          throw new Error("Current password is incorrect.");
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? readSession()?.accessToken;

      if (accessToken) {
        const { user: syncedUser } = await syncCurrentUser(accessToken);
        const current = readSession();

        saveSession(
          {
            accessToken,
            user: syncedUser,
          },
          current?.remember ?? true,
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(
        resetMode
          ? "Password reset. You can now use Arcgenda."
          : "Password changed.",
      );
    } catch (passwordUpdateError) {
      setPasswordError(
        passwordUpdateError instanceof Error
          ? passwordUpdateError.message
          : "Could not update password.",
      );
    } finally {
      setPasswordSaving(false);
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
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-[#007aff] shadow-lg shadow-black/5"
          >
            <ArrowLeft size={16} /> Back to calendar
          </Link>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-[34px] border border-white/70 bg-white/78 p-6 shadow-2xl shadow-[#6d5dfc]/12 backdrop-blur-3xl">
            <div className="grid size-16 place-items-center rounded-3xl bg-[#007aff] text-white shadow-lg shadow-[#007aff]/25">
              <UserRound size={29} />
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-normal">
              Account settings
            </h1>

            <p className="mt-3 text-sm font-semibold leading-6 text-[#636366]">
              Manage your profile, theme preference, session, and security
              controls for Arcgenda.
            </p>

            <div className="mt-6 space-y-3 text-sm font-bold text-[#636366]">
              <div className="flex items-center gap-3 rounded-3xl bg-white/74 p-3 shadow-sm shadow-black/5">
                <Shield className="text-[#34c759]" size={18} /> Protected page,
                login required
              </div>

              <div className="flex items-center gap-3 rounded-3xl bg-white/74 p-3 shadow-sm shadow-black/5">
                <CalendarDays className="text-[#af52de]" size={18} /> Calendar
                workspace stays private
              </div>

              <div className="flex items-center gap-3 rounded-3xl bg-white/74 p-3 shadow-sm shadow-black/5">
                <Sparkles className="text-[#ff9500]" size={18} /> Current plan:{" "}
                {isPremium ? "Premium" : "Free"}
              </div>
            </div>
          </aside>

          <section className="rounded-[34px] border border-white/70 bg-white/78 p-6 shadow-2xl shadow-[#6d5dfc]/12 backdrop-blur-3xl">
            {loading ? (
              <div className="py-16 text-center">
                <div className="mx-auto size-12 animate-pulse rounded-3xl bg-[#007aff]/20" />
                <p className="mt-4 text-sm font-black text-[#636366]">
                  Loading your account...
                </p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={saveAccount}>
                <div>
                  <label className="text-sm font-black text-[#636366]">
                    Email
                  </label>
                  <input
                    className="input-shell mt-2 w-full opacity-70"
                    value={user?.email ?? ""}
                    disabled
                  />
                </div>

                <div>
                  <label className="text-sm font-black text-[#636366]">
                    Display name
                  </label>
                  <input
                    className="input-shell mt-2 w-full"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="text-sm font-black text-[#636366]">
                    Theme
                  </label>
                  <select
                    className="input-shell mt-2 w-full"
                    value={theme ?? "light"}
                    onChange={(event) =>
                      setTheme(event.target.value as AccountUser["theme"])
                    }
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">Use system</option>
                  </select>
                </div>

                {message && (
                  <p className="text-sm font-semibold text-[#34c759]">
                    {message}
                  </p>
                )}

                {error && (
                  <p className="text-sm font-semibold text-[#ff3b30]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25 disabled:opacity-60"
                >
                  <Save size={18} />{" "}
                  {saving ? "Saving..." : "Save account settings"}
                </button>
              </form>
            )}

            <form
              className="mt-6 rounded-[30px] border border-white/70 bg-white/70 p-4 shadow-lg shadow-black/5"
              onSubmit={savePassword}
            >
              <div className="flex items-center gap-2">
                <LockKeyhole size={18} className="text-[#007aff]" />
                <h2 className="text-lg font-black text-[#18181b]">
                  {resetMode ? "Reset password" : "Password"}
                </h2>
              </div>

              <p className="mt-1 text-sm font-semibold leading-6 text-[#636366]">
                {resetMode
                  ? "Choose a new password for your account."
                  : "Change your account password. First confirm your current password."}
              </p>

              <div className="mt-4 space-y-3">
                {!resetMode && (
                  <div className="input-shell flex w-full items-center gap-2 pr-2">
                    <input
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-[#18181b] outline-none placeholder:text-[#9b9baa] focus:ring-0"
                      type={showPassword ? "text" : "password"}
                      placeholder="Current password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      required={!resetMode}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-[#636366] transition active:scale-95"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}

                <input
                  className="input-shell w-full"
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />

                <input
                  className="input-shell w-full"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />

                {resetMode && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="rounded-2xl px-3 py-2 text-sm font-black text-[#007aff] transition hover:bg-white/70 active:scale-95"
                  >
                    {showPassword ? "Hide passwords" : "Show passwords"}
                  </button>
                )}
              </div>

              {passwordMessage && (
                <p className="mt-3 text-sm font-semibold text-[#34c759]">
                  {passwordMessage}
                </p>
              )}

              {passwordError && (
                <p className="mt-3 text-sm font-semibold text-[#ff3b30]">
                  {passwordError}
                </p>
              )}

              <button
                type="submit"
                disabled={passwordSaving}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] text-base font-bold text-white shadow-lg shadow-black/10 disabled:opacity-60"
              >
                <LockKeyhole size={18} />
                {passwordSaving
                  ? resetMode
                    ? "Resetting..."
                    : "Changing..."
                  : resetMode
                    ? "Reset password"
                    : "Change password"}
              </button>
            </form>

            <div className="mt-6 rounded-[30px] border border-white/70 bg-white/70 p-4 shadow-lg shadow-black/5">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#ff9500]" />
                <h2 className="text-lg font-black text-[#18181b]">
                  Plan preview
                </h2>
              </div>

              <p className="mt-1 text-sm font-semibold leading-6 text-[#636366]">
                The plan comparison lives here now, away from the main calendar
                settings.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PlanPreviewCard
                  title="Free"
                  label={isPremium ? "Available" : "Current"}
                >
                  One shared calendar, personal tasks, reminders, alerts, and
                  the core calendar workspace.
                </PlanPreviewCard>

                <PlanPreviewCard
                  title="Premium"
                  label={isPremium ? "Current" : "Preview"}
                  highlighted
                >
                  More shared calendars, richer statistics, advanced planning
                  helpers, and future power-user features.
                </PlanPreviewCard>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] bg-[#fff0f0] p-4">
              <h2 className="text-lg font-black text-[#ff3b30]">Session</h2>

              <p className="mt-1 text-sm font-semibold leading-6 text-[#7c7c8a]">
                Logging out removes the saved app session from this browser and
                returns you to the login page.
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
