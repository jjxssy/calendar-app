"use client";

import { ReactNode, useEffect, useState } from "react";
import { CalendarDays, LogIn, UserPlus } from "lucide-react";
import { clearSession, readSession, saveSession, syncCurrentUser } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";

type AuthState = "checking" | "allowed" | "choice";

type ChoiceReason = "not-signed-in" | "session-expired" | "check-failed";

const MIN_LOADING_MS = 900;
const AUTH_TIMEOUT_MS = 3500;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function MinimalAuthLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <section className="w-full max-w-xs text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <CalendarDays size={22} className="text-[var(--accent)]" />
        </div>
        <p className="mt-4 text-sm font-black">Checking your session</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted)]">
          Looking for a saved login before opening your private calendar.
        </p>
        <div className="mx-auto mt-5 size-6 animate-spin rounded-full border-2 border-[var(--border-soft)] border-t-[var(--accent)]" />
      </section>
    </main>
  );
}

function LoginChoiceScreen({ reason }: { reason: ChoiceReason }) {
  const message =
    reason === "session-expired"
      ? "Your saved session expired. Log in again to open your calendar."
      : reason === "check-failed"
        ? "I could not verify your session. Log in again to continue safely."
        : "No active login was found. Log in to continue, or create an account if you are new here.";

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <section className="w-full max-w-md rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center shadow-xl shadow-[var(--shadow-soft)] backdrop-blur-2xl">
        <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-[var(--accent)] text-white shadow-lg shadow-[var(--shadow-soft)]">
          <CalendarDays size={25} />
        </div>

        <h1 className="mt-4 text-2xl font-black">Login required</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
          {message}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href="/login"
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-black text-white shadow-lg shadow-[var(--shadow-soft)] active:scale-95"
          >
            <LogIn size={17} />
            Log in
          </a>

          <a
            href="/signup"
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-strong)] px-5 text-sm font-black text-[var(--foreground)] active:scale-95"
          >
            <UserPlus size={17} />
            Sign up
          </a>
        </div>

        <a
          href="/"
          className="mt-5 inline-flex text-sm font-bold text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Back to home
        </a>
      </section>
    </main>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [choiceReason, setChoiceReason] = useState<ChoiceReason>("not-signed-in");

  useEffect(() => {
    let cancelled = false;

    async function finishAsChoice(reason: ChoiceReason) {
      await wait(MIN_LOADING_MS);
      if (!cancelled) {
        setChoiceReason(reason);
        setAuthState("choice");
      }
    }

    async function finishAsAllowed() {
      await wait(MIN_LOADING_MS);
      if (!cancelled) setAuthState("allowed");
    }

    async function verifySession() {
      setAuthState("checking");

      try {
        const storedSession = readSession();

        // Fast path: no saved app session. Try Supabase once, but never forever.
        if (!storedSession?.accessToken) {
          const supabase = createClient();
          const { data } = await withTimeout(
            supabase.auth.getSession(),
            AUTH_TIMEOUT_MS,
            "Supabase session check timed out.",
          );

          const supabaseToken = data.session?.access_token;
          if (!supabaseToken) {
            clearSession();
            await finishAsChoice("not-signed-in");
            return;
          }

          const { user } = await withTimeout(
            syncCurrentUser(supabaseToken),
            AUTH_TIMEOUT_MS,
            "User sync timed out.",
          );

          saveSession(
            {
              accessToken: supabaseToken,
              user,
            },
            true,
          );

          await finishAsAllowed();
          return;
        }

        // Saved session path: verify it quickly before rendering the calendar.
        const response = await withTimeout(
          fetch("/api/users/me", {
            method: "GET",
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${storedSession.accessToken}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          }),
          AUTH_TIMEOUT_MS,
          "Saved session check timed out.",
        );

        if (response.ok) {
          await finishAsAllowed();
          return;
        }

        clearSession();
        await finishAsChoice("session-expired");
      } catch {
        clearSession();
        await finishAsChoice("check-failed");
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === "checking") return <MinimalAuthLoading />;
  if (authState === "choice") return <LoginChoiceScreen reason={choiceReason} />;

  return <>{children}</>;
}
