import Link from "next/link";
import {
  BellRing,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  LineChart,
  ListChecks,
  LockKeyhole,
  Palette,
  Share2,
  Shield,
  Sparkles,
  Smartphone,
  Users,
} from "lucide-react";
import { PublicFooter } from "@/components/public-nav/public-footer";
import { PublicNavbar } from "@/components/public-nav/public-navbar";
import { BrandMark } from "@/components/brand/brand-mark";

const featureCards = [
  {
    icon: CalendarDays,
    title: "Calendar-first planning",
    body: "Create events with dates, times, all-day mode, locations, notes, links, priority, recurrence labels, and clear calendar colors.",
    tint: "bg-[#e5f1ff] text-[#007aff]",
  },
  {
    icon: ListChecks,
    title: "Tasks that belong somewhere",
    body: "Attach tasks to events when they are part of a plan, or keep standalone tasks for the day, week, or month.",
    tint: "bg-[#e9fbea] text-[#34c759]",
  },
  {
    icon: BellRing,
    title: "Reminder settings",
    body: "Configure event reminders, task reminders, daily agenda, reschedule reminders, quiet hours, sound, vibration, and device push support.",
    tint: "bg-[#fff4df] text-[#ff9500]",
  },
  {
    icon: Users,
    title: "Shared calendars",
    body: "Use owner, editor, and viewer roles for family, school, work, or project calendars while keeping personal plans separate.",
    tint: "bg-[#f7eaff] text-[#af52de]",
  },
  {
    icon: LineChart,
    title: "Stats and patterns",
    body: "See upcoming plans, completed tasks, cancelled events, active days, completion rate, and simple productivity patterns.",
    tint: "bg-[#fff0f5] text-[#ff2d55]",
  },
  {
    icon: Brain,
    title: "AI Lite, optional",
    body: "Keep AI suggestions off by default, then enable smart scheduling, insights, summaries, and private mode only when you want them.",
    tint: "bg-[#eeeeff] text-[#5856d6]",
  },
];

const workflow = [
  ["1", "Open your workspace", "Arcgenda loads your saved theme, calendars, events, tasks, reminders, and profile from the database first."],
  ["2", "Plan the moment", "Add the event details, choose the calendar and tag, and pin important plans when they deserve the tiny crown."],
  ["3", "Attach the tiny to-dos", "Create linked tasks inside an event or standalone tasks for the selected day, week, or month."],
  ["4", "Let reminders behave", "Choose reminder timing and quiet hours so alerts help instead of poking your brain with a tiny fork."],
  ["5", "Review the week", "Use stats, alerts, task views, and shared calendars to keep the whole schedule readable."],
];

const installNotes = [
  "Install as a PWA from your browser or phone.",
  "Use the Get App page for iPhone, Android, desktop, and notification notes.",
  "Closed-app push requires browser support, saved subscription, VAPID keys, and a scheduler.",
];

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[34px] border border-white/70 bg-white/72 p-5 shadow-2xl shadow-[#6d5dfc]/10 backdrop-blur-3xl ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#af52de]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#636366] md:text-base">{body}</p>
    </div>
  );
}

function HeroPreview() {
  const days = [27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const rows = [
    ["09:00", "Focus block", "#5856d6"],
    ["12:30", "Study sprint", "#007aff"],
    ["17:45", "Family plan", "#ff9500"],
  ];

  return (
    <GlassCard className="relative overflow-hidden p-4 lg:p-5">
      <div className="pointer-events-none absolute -right-14 -top-14 size-40 animate-pulse rounded-full bg-[#7dd3fc]/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-52 animate-pulse rounded-full bg-[#ff9bd2]/35 blur-3xl" />
      <div className="relative rounded-[30px] bg-[#f8f7ff] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8e8e93]">Live workspace</p>
            <h3 className="mt-1 text-2xl font-black">June overview</h3>
          </div>
          <span className="rounded-full bg-[#e9fbea] px-3 py-1 text-xs font-black text-[#34c759]">Synced</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {days.map((day, index) => (
            <div
              key={`${day}-${index}`}
              className={`grid aspect-square place-items-center rounded-2xl text-xs font-black shadow-sm ${
                day === 3
                  ? "bg-[#007aff] text-white shadow-[#007aff]/25"
                  : index % 4 === 0
                    ? "bg-[#f7eaff] text-[#af52de]"
                    : "bg-white/80 text-[#636366]"
              }`}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {rows.map(([time, title, color]) => (
            <div key={title} className="flex items-center gap-3 rounded-3xl bg-white/82 p-3 shadow-lg shadow-black/5">
              <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#8e8e93]">{time}</p>
                <p className="truncate text-sm font-black">{title}</p>
              </div>
              <CheckCircle2 className="ml-auto text-[#34c759]" size={18} />
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function LoadingPreview() {
  const steps = ["Profile", "Theme", "Calendars", "Events", "Tasks"];
  return (
    <GlassCard className="overflow-hidden">
      <div className="rounded-[30px] bg-[#f8f7ff] p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative grid size-14 place-items-center rounded-3xl bg-[#007aff] text-white shadow-xl shadow-[#007aff]/25">
              <CalendarDays size={25} />
              <span className="absolute -right-1 -top-1 size-4 animate-ping rounded-full bg-[#34c759]" />
              <span className="absolute -right-1 -top-1 size-4 rounded-full bg-[#34c759]" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#af52de]">No fake dashboard</p>
              <h3 className="text-xl font-black">Database-first loading</h3>
            </div>
          </div>
          <span className="grid size-10 place-items-center rounded-full bg-white shadow-lg shadow-black/5">
            <span className="size-5 animate-spin rounded-full border-[3px] border-[#d7d7e8] border-t-[#007aff]" />
          </span>
        </div>
        <p className="mt-4 text-sm font-semibold leading-6 text-[#636366]">
          The app waits for your saved workspace before showing the real calendar, so users do not see zero/default data first.
        </p>
        <div className="mt-5 grid gap-2">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 shadow-sm shadow-black/5">
              <span className="grid size-6 place-items-center rounded-full bg-[#e5f1ff] text-[11px] font-black text-[#007aff]">{index + 1}</span>
              <span className="text-sm font-bold text-[#636366]">{step}</span>
              <span className="ml-auto flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-[#007aff]" />
                <span className="size-1.5 animate-bounce rounded-full bg-[#af52de] [animation-delay:120ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-[#ff2d55] [animation-delay:240ms]" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function PhonePreview() {
  return (
    <GlassCard>
      <div className="mx-auto max-w-[245px] rounded-[34px] border-8 border-[#1d1d1f] bg-[#f8f7ff] p-3 shadow-2xl shadow-black/20">
        <div className="mx-auto mb-3 h-4 w-20 rounded-full bg-[#1d1d1f]" />
        <div className="rounded-3xl bg-white p-4">
          <Download className="text-[#007aff]" size={22} />
          <h3 className="mt-3 text-lg font-black">Install Arcgenda</h3>
          <p className="mt-2 text-xs font-bold leading-5 text-[#636366]">
            Add to Home Screen, open like an app, and enable notifications when the device supports them.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Cal", "Tasks", "AI"].map((item) => (
            <span key={item} className="rounded-2xl bg-white/80 px-2 py-2 text-center text-[11px] font-black text-[#636366]">{item}</span>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

export function PublicHome() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f6f4ff] px-5 py-5 text-[#18181b]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="float-soft absolute -left-24 top-[-90px] size-80 rounded-full bg-[#ff9bd2]/45 blur-3xl" />
        <div className="float-soft-delayed absolute right-[-90px] top-28 size-80 rounded-full bg-[#7dd3fc]/50 blur-3xl" />
        <div className="absolute bottom-[-140px] left-16 size-96 rounded-full bg-[#fef08a]/45 blur-3xl" />
      </div>

      <PublicNavbar activeHref="/" />

      <section className="relative mx-auto grid max-w-6xl gap-8 py-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-16">
        <div className="fade-in-up">
          <BrandMark size="lg" />
          <p className="mt-5 inline-flex rounded-full bg-white/72 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#af52de] shadow-lg shadow-black/5 backdrop-blur-xl">
            Colorful planning, database-first
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
            A calendar that opens with your real life, not placeholder noise.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#636366] md:text-lg">
            Arcgenda brings calendars, tasks, reminders, shared planning, stats, PWA install support, and optional AI Lite into one soft, fast workspace.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-[#1d1d1f] px-6 py-3 text-base font-bold text-white shadow-xl shadow-black/20 transition active:scale-95">
              Start free
            </Link>
            <Link href="/login" className="rounded-full bg-white/78 px-6 py-3 text-base font-bold text-[#007aff] shadow-lg shadow-black/5 backdrop-blur-xl transition active:scale-95">
              Log in
            </Link>
            <Link href="/get-app" className="rounded-full bg-[#e5f1ff] px-6 py-3 text-base font-bold text-[#007aff] transition active:scale-95">
              Get the app
            </Link>
          </div>
          <div className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[["3", "free calendars"], ["Roles", "owner/editor/viewer"], ["PWA", "phone + desktop"]].map(([value, label]) => (
              <div key={label} className="rounded-3xl bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
                <p className="text-2xl font-black">{value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8e8e93]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <HeroPreview />
      </section>

      <section className="relative mx-auto max-w-6xl py-10">
        <SectionTitle
          eyebrow="What it includes"
          title="The full Arcgenda idea, explained clearly"
          body="No mystery buttons. No fake numbers before login. The app is designed around a real workspace that loads your saved account data first."
        />
        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-[30px] border border-white/65 bg-white/72 p-5 shadow-xl shadow-black/5 backdrop-blur-2xl transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#6d5dfc]/10">
                <span className={`grid size-12 place-items-center rounded-2xl ${feature.tint}`}>
                  <Icon size={21} />
                </span>
                <h3 className="mt-4 text-lg font-black">{feature.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#636366]">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-5 py-10 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
        <LoadingPreview />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#af52de]">Better first impression</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">A loading screen that actually matches what is loading.</h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#636366] md:text-base">
            Instead of showing a dark shell, zeros, or old default cards, Arcgenda can show a branded sync screen while it fetches profile, theme, calendars, categories, events, tasks, reminders, and notification preferences.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {["Theme applies after DB fetch", "No demo event flash", "Workspace data loads together", "Friendly status animation"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-3xl bg-white/70 p-3 text-sm font-bold shadow-lg shadow-black/5 backdrop-blur-xl">
                <CheckCircle2 className="text-[#34c759]" size={18} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl py-10">
        <SectionTitle
          eyebrow="Workflow"
          title="A simple loop for daily planning"
          body="The app keeps each idea in its own place: calendars hold plans, tags describe them, tasks attach when useful, reminders behave, and stats summarize the week."
        />
        <div className="mt-8 grid gap-3 md:grid-cols-5">
          {workflow.map(([number, title, body]) => (
            <article key={title} className="rounded-[28px] bg-white/72 p-4 shadow-lg shadow-black/5 backdrop-blur-xl transition hover:-translate-y-1">
              <span className="grid size-9 place-items-center rounded-full bg-[#1d1d1f] text-sm font-black text-white">{number}</span>
              <h3 className="mt-4 text-base font-black">{title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#636366]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-5 py-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#af52de]">Privacy and control</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Your planning data should feel organized, not exposed.</h2>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-[#636366] md:text-base">
            Arcgenda keeps AI Lite optional, separates shared calendars from personal ones, and makes device notification support clear instead of promising magic smoke.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              [Shield, "AI optional and off by default"],
              [LockKeyhole, "Private mode controls prepared"],
              [Share2, "Share calendars by role"],
              [Palette, "Saved theme preference"],
            ].map(([Icon, label]) => {
              const TypedIcon = Icon as typeof Shield;
              return (
                <div key={label as string} className="flex items-center gap-3 rounded-3xl bg-white/70 p-3 text-sm font-bold shadow-lg shadow-black/5 backdrop-blur-xl">
                  <TypedIcon className="text-[#007aff]" size={18} />
                  {label as string}
                </div>
              );
            })}
          </div>
        </div>
        <GlassCard>
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-[#e9fbea] text-[#34c759]"><Shield size={21} /></span>
            <div>
              <p className="text-sm font-bold text-[#8e8e93]">Trust panel</p>
              <h3 className="text-2xl font-semibold">Clear settings, fewer surprises</h3>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {["Quiet hours pause interruptions", "Device toggles reflect browser support", "Push setup explains VAPID + scheduler", "Theme comes from saved user settings"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-3xl bg-white/80 p-3 text-sm font-bold shadow-lg shadow-black/5">
                <CheckCircle2 size={16} className="text-[#34c759]" />
                {item}
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-5 py-10 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
        <PhonePreview />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#af52de]">Install like an app</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Use Arcgenda from your home screen.</h2>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-[#636366] md:text-base">
            Arcgenda is prepared as a PWA for mobile and desktop. The app explains what each device supports so notifications and install steps do not feel like a haunted settings maze.
          </p>
          <div className="mt-5 grid gap-3">
            {installNotes.map((note) => (
              <div key={note} className="flex items-center gap-3 rounded-3xl bg-white/70 p-3 text-sm font-bold shadow-lg shadow-black/5 backdrop-blur-xl">
                <Smartphone className="text-[#007aff]" size={18} />
                {note}
              </div>
            ))}
          </div>
          <Link href="/get-app" className="mt-6 inline-flex rounded-full bg-[#007aff] px-6 py-3 text-base font-bold text-white shadow-lg shadow-[#007aff]/25 transition active:scale-95">
            Get App instructions
          </Link>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl py-10">
        <div className="overflow-hidden rounded-[40px] border border-white/10 bg-[#1d1d1f] p-7 text-center text-white shadow-2xl shadow-black/20 md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,122,255,.35),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,45,85,.28),transparent_30%)]" />
          <div className="relative">
            <BrandMark size="lg" className="justify-center" />
            <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-white/50">Free to start</p>
            <h2 className="mx-auto mt-2 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">Open a cleaner calendar, then let the little chaos goblins retire.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/70 md:text-base">
              Build your calendars, link tasks, save reminders, review patterns, and keep your week visible without showing fake data before your workspace loads.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="rounded-full bg-white px-6 py-3 text-base font-bold text-[#1d1d1f] transition active:scale-95">Start free</Link>
              <Link href="/login" className="rounded-full bg-white/10 px-6 py-3 text-base font-bold text-white transition active:scale-95">Log in</Link>
              <Link href="/features" className="rounded-full bg-white/10 px-6 py-3 text-base font-bold text-white transition active:scale-95">View features</Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
