"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, MailCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { saveSession, syncCurrentUser } from "@/lib/api";
import { BrandMark } from "@/components/brand/brand-mark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();

      if (forgotMode) {
        const targetEmail = email.trim().toLowerCase();

        if (!targetEmail) {
          throw new Error("Enter your email first.");
        }

        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/account?mode=reset-password`
            : undefined;

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          targetEmail,
          { redirectTo },
        );

        if (resetError) throw resetError;

        setMessage("Password reset link sent. Check your email.");
        return;
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) throw loginError;
      if (!data.user || !data.session?.access_token) {
        throw new Error("Login succeeded, but no session was returned. Try again.");
      }

      const { user } = await syncCurrentUser(data.session.access_token);

      saveSession(
        {
          accessToken: data.session.access_token,
          user,
        },
        remember,
      );

      router.replace("/calendar");
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : forgotMode
            ? "Could not send password reset email."
            : "Could not log in. Check your email and password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center overflow-hidden bg-[var(--background)] px-5 text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-80px] size-72 rounded-full bg-[#ff9bd2]/30 blur-3xl" />
        <div className="absolute right-[-90px] top-28 size-72 rounded-full bg-[#7dd3fc]/30 blur-3xl" />
        <div className="absolute bottom-[-120px] left-12 size-80 rounded-full bg-[#fef08a]/20 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md rounded-[36px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-2xl shadow-[var(--shadow-soft)] backdrop-blur-3xl">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size="md" />
          <div>
            <p className="text-sm font-bold text-[var(--muted)]">Arcgenda</p>
            <h1 className="text-3xl font-semibold tracking-normal text-[var(--foreground)]">
              {forgotMode ? "Reset password" : "Log in"}
            </h1>
          </div>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <input
            className="input-shell w-full"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {!forgotMode && (
            <div className="input-shell flex w-full items-center gap-2 pr-2">
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted-strong)] focus:ring-0"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--muted)] transition active:scale-95"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {!forgotMode && (
            <div className="flex items-center justify-between gap-3">
              <label className="flex flex-1 items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-bold text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Remember me
              </label>

              <button
                type="button"
                onClick={() => {
                  setForgotMode(true);
                  setError("");
                  setMessage("");
                }}
                className="rounded-2xl px-3 py-3 text-sm font-black text-[var(--accent)] transition hover:bg-[var(--surface-strong)] active:scale-95"
              >
                Forgot?
              </button>
            </div>
          )}

          {forgotMode && (
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
              Enter your email and Arcgenda will send you a password reset link.
            </div>
          )}

          {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
          {message && (
            <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-600 dark:text-emerald-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-base font-bold text-white shadow-lg shadow-[var(--shadow-soft)] disabled:opacity-60"
          >
            {forgotMode ? <MailCheck size={18} /> : <LogIn size={18} />}
            {submitting
              ? forgotMode
                ? "Sending..."
                : "Logging in..."
              : forgotMode
                ? "Send reset link"
                : "Log in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-[var(--muted)]">
          {forgotMode ? (
            <>
              Remembered it?{" "}
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setError("");
                  setMessage("");
                }}
                className="font-bold text-[var(--accent)]"
              >
                Back to login
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <Link className="font-bold text-[var(--accent)]" href="/signup">
                Create an account
              </Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}