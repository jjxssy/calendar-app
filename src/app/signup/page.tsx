"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { saveSession, syncCurrentUser } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
        },
      });

      if (error || !data.user) throw error;

      if (!data.session) {
        setMessage("Account created. Check your email to confirm it, then log in.");
        return;
      }

      const { user } = await syncCurrentUser();
      saveSession({
        accessToken: data.session.access_token,
        user,
      });
      router.replace("/");
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
          <span className="grid size-12 place-items-center rounded-full bg-[#e5f1ff] text-[#007aff]">
            <CalendarDays size={22} />
          </span>
          <div>
            <p className="text-sm font-bold text-[#8e8e93]">Arcgenda Calendar</p>
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
          <input
            className="input-shell w-full"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {message && <p className="text-sm font-semibold text-[#34c759]">{message}</p>}
          {error && <p className="text-sm font-semibold text-[#ff3b30]">{error}</p>}
          <button
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25 disabled:opacity-60"
          >
            <UserPlus size={18} />
            {submitting ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-[#7c7c8a]">
          Already have an account?{" "}
          <Link className="font-bold text-[#007aff]" href="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
