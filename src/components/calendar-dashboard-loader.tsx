"use client";

import dynamic from "next/dynamic";

const CalendarDashboard = dynamic(() => import("@/components/calendar-dashboard"), {
  ssr: false,
  loading: () => (
    <main className="min-h-dvh bg-[#f6f4ff] px-4 py-4 text-[#18181b] md:px-6">
      <section className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-7xl gap-4 rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-xl shadow-black/5 md:grid-cols-[260px_1fr]">
        <aside className="hidden rounded-[24px] bg-white/70 p-4 md:block">
          <div className="h-10 w-32 rounded-full bg-[#e5e5ea]" />
          <div className="mt-8 space-y-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-10 rounded-2xl bg-[#f2f2f7]" />
            ))}
          </div>
        </aside>
        <div className="rounded-[24px] bg-white/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="h-4 w-24 rounded-full bg-[#e5e5ea]" />
              <div className="mt-3 h-8 w-48 rounded-full bg-[#dfe9ff]" />
            </div>
            <div className="h-11 w-28 rounded-full bg-[#007aff]/20" />
          </div>
          <div className="mt-6 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }, (_, index) => (
              <div key={index} className="aspect-square rounded-2xl bg-[#f2f2f7]" />
            ))}
          </div>
        </div>
      </section>
    </main>
  ),
});

export function CalendarDashboardLoader() {
  return <CalendarDashboard />;
}
