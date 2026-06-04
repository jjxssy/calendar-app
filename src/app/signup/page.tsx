"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { saveSession, syncCurrentUser } from "@/lib/api";
import { BrandMark } from "@/components/brand/brand-mark";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const trimmedEmail = email.trim();
      const trimmedName = name.trim();

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { name: trimmedName },
          emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
        },
      });

      if (error || !data.user) throw error;

      if (!data.session) {
        setMessage(
          "Account created. Check your email to confirm it, then log in.",
        );
        return;
      }

      const { user } = await syncCurrentUser(data.session.access_token);
      saveSession(
        {
          accessToken: data.session.access_token,
          user,
        },
        true,
      );
      router.replace("/calendar");
    } catch (signupError) {
      setError(
        signupError instanceof Error
          ? signupError.message
          : "Could not create account. Try another email or a stronger password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center overflow-hidden bg-[#f6f4ff] px-5 text-[#18181b]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-80px] size-72 rounded-full bg-[#ff9bd2]/50 blur-3xl" />
        <div className="absolute right-[-90px] top-28 size-72 rounded-full bg-[#7dd3fc]/55 blur-3xl" />
        <div className="absolute bottom-[-120px] left-12 size-80 rounded-full bg-[#fef08a]/45 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md rounded-[36px] border border-white/70 bg-white/76 p-6 shadow-2xl shadow-[#6d5dfc]/15 backdrop-blur-3xl">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size="md" />
          <div>
            <p className="text-sm font-bold text-[#8e8e93]">Arcgenda</p>
            <h1 className="text-3xl font-semibold tracking-normal">Sign up</h1>
          </div>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <input
            className="input-shell w-full"
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="input-shell w-full"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <div className="input-shell flex w-full items-center gap-2 pr-2 overflow-hidden">
            <input
              className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-base font-semibold text-[var(--foreground)] outline-none ring-0 placeholder:text-[var(--muted-strong)] focus:border-0 focus:outline-none focus:ring-0"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="grid size-9 shrink-0 place-items-center rounded-full text-[#7c7c8a] transition active:scale-95 dark:text-[var(--muted)]"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {message && (
            <p className="text-sm font-semibold text-[#34c759]">{message}</p>
          )}
          {error && (
            <p className="text-sm font-semibold text-[#ff3b30]">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25 disabled:opacity-60"
          >
            <UserPlus size={18} />
            {submitting ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-[#7c7c8a]">
          Already have an account?{" "}
          <a
            href="/login"
            className="font-bold text-[#007aff] underline-offset-4 hover:underline"
          >
            Log in
          </a>
        </p>
      </section>
    </main>
  );
}
