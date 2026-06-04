"use client";

import dynamic from "next/dynamic";
import { CalendarDays } from "lucide-react";

function MinimalCalendarLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
      <section className="flex w-full max-w-xs flex-col items-center rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] px-6 py-7 text-center shadow-xl shadow-[var(--shadow-soft)] backdrop-blur-2xl">
        <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent)] text-white shadow-lg shadow-[var(--shadow-soft)]">
          <CalendarDays size={23} />
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-[var(--accent)]" />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
            Loading
          </p>
        </div>

        <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--foreground)]">
          Opening Arcgenda
        </h1>
        <p className="mt-2 max-w-[230px] text-sm font-semibold leading-6 text-[var(--muted)]">
          Checking your session and preparing your workspace.
        </p>

        <div className="mt-6 flex items-center justify-center gap-1.5" aria-label="Loading">
          <span className="size-2 animate-bounce rounded-full bg-[var(--accent)]" />
          <span className="size-2 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:120ms]" />
          <span className="size-2 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:240ms]" />
        </div>
      </section>
    </main>
  );
}

const CalendarDashboard = dynamic(() => import("@/components/calendar-dashboard"), {
  ssr: false,
  loading: () => <MinimalCalendarLoading />,
});

export function CalendarDashboardLoader() {
  return <CalendarDashboard />;
}
