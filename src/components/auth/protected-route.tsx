"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { CalendarDays, LogIn, UserPlus } from "lucide-react";
import { clearSession, readSession, saveSession, syncCurrentUser } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";

type AuthState = "checking" | "allowed" | "choice";

function MinimalAuthLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <section className="w-full max-w-xs text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <CalendarDays size={22} className="text-[var(--accent)]" />
        </div>
        <p className="mt-4 text-sm font-black">Checking your session</p>
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
          One tiny second, checking if you are logged in.
        </p>
        <div className="mx-auto mt-5 size-6 animate-spin rounded-full border-2 border-[var(--border-soft)] border-t-[var(--accent)]" />
      </section>
    </main>
  );
}

function LoginChoiceScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <section className="w-full max-w-md rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center shadow-xl shadow-[var(--shadow-soft)] backdrop-blur-2xl">
        <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-[var(--accent)] text-white shadow-lg shadow-[var(--shadow-soft)]">
          <CalendarDays size={25} />
        </div>

        <h1 className="mt-4 text-2xl font-black">Login required</h1>

        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
          Your calendar is private. Log in to continue, or create an account if you are new here.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/login"
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-black text-white shadow-lg shadow-[var(--shadow-soft)] active:scale-95"
          >
            <LogIn size={17} />
            Log in
          </Link>

          <Link
            href="/signup"
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-strong)] px-5 text-sm font-black text-[var(--foreground)] active:scale-95"
          >
            <UserPlus size={17} />
            Sign up
          </Link>
        </div>

        <Link
          href="/"
          className="mt-5 inline-flex text-sm font-bold text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        clearSession();
        setAuthState("choice");
      }
    }, 1200);

    async function verifySession() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const supabaseToken = data.session?.access_token;

        if (supabaseToken) {
          const { user } = await syncCurrentUser(supabaseToken);

          if (cancelled) return;

          const previous = readSession();

          saveSession(
            {
              accessToken: supabaseToken,
              user,
            },
            previous?.remember ?? true,
          );

          window.clearTimeout(timeout);
          setAuthState("allowed");
          return;
        }

        const storedSession = readSession();

        if (storedSession?.accessToken) {
          const response = await fetch("/api/users/me", {
            method: "GET",
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${storedSession.accessToken}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });

          if (response.ok) {
            if (cancelled) return;

            window.clearTimeout(timeout);
            setAuthState("allowed");
            return;
          }
        }

        clearSession();

        if (!cancelled) {
          window.clearTimeout(timeout);
          setAuthState("choice");
        }
      } catch {
        clearSession();

        if (!cancelled) {
          window.clearTimeout(timeout);
          setAuthState("choice");
        }
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  if (authState === "checking") return <MinimalAuthLoading />;
  if (authState === "choice") return <LoginChoiceScreen />;

  return <>{children}</>;
}