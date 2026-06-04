"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { saveSession, syncCurrentUser } from "@/lib/api";
import { BrandMark } from "@/components/brand/brand-mark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
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
              Log in
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

          <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-bold text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Remember me on this browser
          </label>

          {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-base font-bold text-white shadow-lg shadow-[var(--shadow-soft)] disabled:opacity-60"
          >
            <LogIn size={18} />
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-[var(--muted)]">
          New here?{" "}
          <Link className="font-bold text-[var(--accent)]" href="/signup">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
