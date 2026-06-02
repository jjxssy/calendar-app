import Link from "next/link";
import {
  Brain,
  CheckCircle2,
  Download,
  LineChart,
  LockKeyhole,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { PublicFooter } from "@/components/public-nav/public-footer";
import { PublicNavbar } from "@/components/public-nav/public-navbar";
import { BrandMark } from "@/components/brand/brand-mark";

const freeFeatures = [
  ["Multiple calendars", "Up to 3 free calendars, with shared calendars counting toward the same clear limit."],
  ["Tasks in events", "Plan the event and the checklist together, then unlink tasks without deleting them."],
  ["Reminders", "Event, task, agenda, birthday, reschedule, desktop, and PWA notification settings."],
  ["Shared basics", "Owner, editor, and viewer roles for family, work, school, or project calendars."],
  ["Stats", "A simple dashboard for progress, cancelled events, active days, and completion rate."],
  ["AI Lite", "Optional rule-based scheduling suggestions, off by default and privacy-first."],
  ["PWA install", "Install Arcgenda from your browser and use it like a lightweight app."],
];

const steps = [
  ["Plan your day", "Add events, all-day plans, notes, links, and locations."],
  ["Link tasks", "Keep checklists inside the event where they make sense."],
  ["Get reminders", "Use reminder settings without pretending push is finished."],
  ["Share when needed", "Invite people to a calendar or prepare a single-event share."],
  ["Track progress", "Use stats to see what your week is actually doing."],
];

function DemoWindow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`hover-lift rounded-[34px] border border-white/65 bg-white/72 p-4 shadow-2xl shadow-[#6d5dfc]/12 backdrop-blur-3xl ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#af52de]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-5xl">{title}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#636366] md:text-base">{body}</p>
    </div>
  );
}

function MiniCalendarPreview() {
  const days = [26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
  return (
    <DemoWindow className="float-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#8e8e93]">June</p>
          <h3 className="text-2xl font-semibold">See your day</h3>
        </div>
        <span className="rounded-full bg-[#e5f1ff] px-3 py-1 text-sm font-bold text-[#007aff]">Today</span>
      </div>
      <div className="mt-4 grid grid-cols-7 text-center text-[11px] font-black text-[#8e8e93]">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 grid-rows-5 gap-1.5">
        {days.map((day, index) => (
          <div
            key={`${day}-${index}`}
            className={`grid aspect-square place-items-center rounded-2xl text-xs font-black ${
              day === 24 && index === 29
                ? "bg-[#007aff] text-white shadow-lg shadow-[#007aff]/25"
                : "bg-white/75 text-[#636366]"
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {[
          ["09:30", "Health check-in", "#34c759"],
          ["12:00", "Study focus", "#5856d6"],
          ["16:30", "Family dinner", "#ff9500"],
        ].map(([time, title, color]) => (
          <div key={title} className="flex items-center gap-3 rounded-3xl bg-white/78 p-3 shadow-lg shadow-black/5">
            <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            <div>
              <p className="text-xs font-bold text-[#8e8e93]">{time}</p>
              <p className="text-sm font-black">{title}</p>
            </div>
          </div>
        ))}
      </div>
    </DemoWindow>
  );
}

function LinkedTasksPreview() {
  return (
    <DemoWindow>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[#e9fbea] text-[#34c759]">
          <CheckCircle2 size={20} />
        </span>
        <div>
          <p className="text-sm font-bold text-[#8e8e93]">Linked tasks</p>
          <h3 className="text-xl font-semibold">Tasks live inside your schedule</h3>
        </div>
      </div>
      <div className="mt-4 rounded-3xl bg-[#f8f7ff] p-4">
        <p className="text-sm font-black">Project planning call</p>
        <p className="text-xs font-bold text-[#8e8e93]">Tomorrow, 10:00</p>
        <div className="mt-3 space-y-2">
          {[
            ["Send agenda", true],
            ["Prepare notes", false],
            ["Confirm owner", false],
          ].map(([label, done]) => (
            <div key={String(label)} className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold">
              <span className={`grid size-5 place-items-center rounded-full ${done ? "bg-[#34c759] text-white" : "bg-[#e5e5ea] text-transparent"}`}>
                <CheckCircle2 size={13} />
              </span>
              <span className={done ? "text-[#8e8e93] line-through" : "text-[#18181b]"}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </DemoWindow>
  );
}

function SharedPreview() {
  return (
    <DemoWindow>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[#f7eaff] text-[#af52de]">
          <Users size={20} />
        </span>
        <div>
          <p className="text-sm font-bold text-[#8e8e93]">Shared calendar</p>
          <h3 className="text-xl font-semibold">Share only what you want</h3>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {[
          ["Family", "Owner", "Created by owner"],
          ["Work sprint", "Editor", "Edited by teammate"],
          ["Dinner plan", "Viewer", "Specific event share"],
        ].map(([name, role, meta]) => (
          <div key={name} className="rounded-3xl bg-white/76 p-3 shadow-lg shadow-black/5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-black">{name}</p>
              <span className="rounded-full bg-[#e5f1ff] px-3 py-1 text-xs font-black text-[#007aff]">{role}</span>
            </div>
            <p className="mt-1 text-xs font-bold text-[#8e8e93]">{meta}</p>
          </div>
        ))}
      </div>
    </DemoWindow>
  );
}

function AiPreview() {
  return (
    <DemoWindow>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[#eeeeff] text-[#5856d6]">
          <Brain size={20} />
        </span>
        <div>
          <p className="text-sm font-bold text-[#8e8e93]">AI Lite</p>
          <h3 className="text-xl font-semibold">Smart suggestions, fully optional</h3>
        </div>
      </div>
      <div className="mt-4 rounded-3xl bg-[#f8f7ff] p-4">
        <p className="text-sm font-black text-[#5856d6]">Suggestion</p>
        <p className="mt-1 text-sm font-bold leading-6 text-[#636366]">
          You have two urgent tasks and a free 30-minute block at 15:00. Consider a focus session.
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-3xl bg-white/78 p-3">
        <div>
          <p className="text-sm font-black">AI features</p>
          <p className="text-xs font-bold text-[#8e8e93]">Off by default</p>
        </div>
        <span className="flex h-8 w-14 items-center rounded-full bg-[#e5e5ea] p-1">
          <span className="size-6 rounded-full bg-white shadow-sm" />
        </span>
      </div>
    </DemoWindow>
  );
}

function StatsPreview() {
  return (
    <DemoWindow>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[#fff0f5] text-[#ff2d55]">
          <LineChart size={20} />
        </span>
        <div>
          <p className="text-sm font-bold text-[#8e8e93]">Patterns</p>
          <h3 className="text-xl font-semibold">Know your week</h3>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          ["82%", "Task completion"],
          ["3", "Cancelled events"],
          ["Thu", "Most active day"],
          ["12", "Upcoming plans"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-3xl bg-white/76 p-4 shadow-lg shadow-black/5">
            <p className="text-2xl font-black">{value}</p>
            <p className="mt-1 text-xs font-bold text-[#8e8e93]">{label}</p>
          </div>
        ))}
      </div>
    </DemoWindow>
  );
}

function InstallPreview() {
  return (
    <DemoWindow>
      <div className="mx-auto max-w-[230px] rounded-[34px] border-8 border-[#1d1d1f] bg-[#f8f7ff] p-3 shadow-2xl shadow-black/20">
        <div className="mx-auto mb-3 h-4 w-20 rounded-full bg-[#1d1d1f]" />
        <div className="rounded-3xl bg-white p-4">
          <Download className="text-[#007aff]" size={22} />
          <h3 className="mt-3 text-lg font-black">Install Arcgenda</h3>
          <p className="mt-2 text-xs font-bold leading-5 text-[#636366]">
            Add to Home Screen, open like an app, and enable notifications when supported.
          </p>
        </div>
      </div>
    </DemoWindow>
  );
}

export function PublicHome() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f6f4ff] px-5 py-5 text-[#18181b]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="float-soft absolute -left-24 top-[-80px] size-72 rounded-full bg-[#ff9bd2]/45 blur-3xl" />
        <div className="float-soft-delayed absolute right-[-90px] top-28 size-72 rounded-full bg-[#7dd3fc]/50 blur-3xl" />
        <div className="absolute bottom-[-120px] left-12 size-80 rounded-full bg-[#fef08a]/40 blur-3xl" />
      </div>

      <PublicNavbar activeHref="/" />

      <section className="relative mx-auto grid max-w-6xl gap-7 py-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-16">
        <div className="fade-in-up">
          <BrandMark size="lg" />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.14em] text-[#af52de]">
            Free colorful productivity
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight tracking-normal md:text-7xl">
            Arcgenda turns your day into a calm, colorful plan.
          </h1>
          <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#636366]">
            A modern calendar for events, linked tasks, reminders, shared planning, stats, and optional AI-lite suggestions.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-[#1d1d1f] px-6 py-3 text-base font-bold text-white shadow-xl shadow-black/20">
              Get started free
            </Link>
            <Link href="/login" className="rounded-full bg-white/75 px-6 py-3 text-base font-bold text-[#007aff] shadow-lg shadow-black/5 backdrop-blur-xl">
              Log in
            </Link>
            <Link href="/features" className="rounded-full bg-[#f7eaff] px-6 py-3 text-base font-bold text-[#8b35bd]">
              View features
            </Link>
          </div>
        </div>
        <MiniCalendarPreview />
      </section>

      <section className="relative mx-auto max-w-6xl py-10">
        <SectionTitle
          eyebrow="Free features"
          title="Everything you need to feel organized before paying for anything"
          body="The homepage uses safe demo data only. You can explore the feel of Arcgenda without logging in or connecting private calendar data."
        />
        <div className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {freeFeatures.map(([title, body]) => (
            <article key={title} className="hover-lift rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
              <Sparkles className="text-[#af52de]" size={19} />
              <h3 className="mt-3 text-base font-black">{title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#636366]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl py-10">
        <SectionTitle
          eyebrow="Product demo"
          title="Taste the Arcgenda flow"
          body="These previews are interactive-looking mockups, not private user data. They show how the real app is meant to feel."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <LinkedTasksPreview />
          <SharedPreview />
          <AiPreview />
          <StatsPreview />
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl py-10">
        <SectionTitle
          eyebrow="How it works"
          title="A simple loop for everyday planning"
          body="Arcgenda keeps the big concepts separate: calendars hold plans, tags describe them, tasks attach when useful, and stats show patterns."
        />
        <div className="mt-7 grid gap-3 md:grid-cols-5">
          {steps.map(([title, body], index) => (
            <article key={title} className="hover-lift rounded-[28px] bg-white/72 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
              <span className="grid size-9 place-items-center rounded-full bg-[#1d1d1f] text-sm font-black text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-black">{title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#636366]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-4 py-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <DemoWindow>
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-[#e9fbea] text-[#34c759]">
              <LockKeyhole size={21} />
            </span>
            <div>
              <p className="text-sm font-bold text-[#8e8e93]">Trust controls</p>
              <h2 className="text-2xl font-semibold">Privacy-first AI</h2>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {["AI optional and off by default", "Private mode placeholder prepared", "Your data is not sold", "You control what future AI may use"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-3xl bg-white/78 p-3 text-sm font-bold shadow-lg shadow-black/5">
                <span className="grid size-6 place-items-center rounded-full bg-[#34c759] text-white">
                  <CheckCircle2 size={14} />
                </span>
                {item}
              </div>
            ))}
          </div>
        </DemoWindow>
        <DemoWindow>
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-[#e5f1ff] text-[#007aff]">
              <Share2 size={21} />
            </span>
            <div>
              <p className="text-sm font-bold text-[#8e8e93]">Collaboration</p>
              <h2 className="text-2xl font-semibold">Family, work, and project planning</h2>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#636366]">
            Share a whole calendar with owner, editor, and viewer roles, or prepare a specific event share when you only want to reveal one plan.
          </p>
        </DemoWindow>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-4 py-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#af52de]">Install like an app</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-5xl">Use Arcgenda from your home screen.</h2>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#636366] md:text-base">
            Arcgenda is prepared as a PWA for iPhone, Android, Windows, and Mac. The Get App page explains install steps and notification limitations clearly.
          </p>
          <Link href="/get-app" className="mt-5 inline-flex rounded-full bg-[#007aff] px-6 py-3 text-base font-bold text-white shadow-lg shadow-[#007aff]/25">
            Get App instructions
          </Link>
        </div>
        <InstallPreview />
      </section>

      <section className="relative mx-auto max-w-6xl py-10">
        <div className="rounded-[38px] border border-white/70 bg-[#1d1d1f] p-7 text-center text-white shadow-2xl shadow-black/20 md:p-10">
          <BrandMark size="lg" className="justify-center" />
          <h2 className="mt-4 text-3xl font-semibold tracking-normal md:text-5xl">Start organizing for free.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/70 md:text-base">
            Build your calendar, link tasks, prepare reminders, and keep your week visible.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-full bg-white px-6 py-3 text-base font-bold text-[#1d1d1f]">
              Start free
            </Link>
            <Link href="/login" className="rounded-full bg-white/10 px-6 py-3 text-base font-bold text-white">
              Log in
            </Link>
            <Link href="/features" className="rounded-full bg-white/10 px-6 py-3 text-base font-bold text-white">
              View features
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
