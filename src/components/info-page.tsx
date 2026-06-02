import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { PublicFooter } from "@/components/public-nav/public-footer";
import { PublicNavbar } from "@/components/public-nav/public-navbar";

const pageRouteByTitle: Record<string, string> = {
  "About Arcgenda": "/about",
  "Cookie Policy": "/cookies",
  "Everything included in Arcgenda": "/features",
  "Feedback and support": "/contact",
  "Get Arcgenda": "/get-app",
  "How Arcgenda works": "/help",
  "Privacy Policy": "/privacy",
  "Terms of Service": "/terms",
};

export function InfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f6f4ff] px-5 py-6 text-[#18181b]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-80px] size-72 rounded-full bg-[#ff9bd2]/45 blur-3xl" />
        <div className="absolute right-[-90px] top-28 size-72 rounded-full bg-[#7dd3fc]/50 blur-3xl" />
        <div className="absolute bottom-[-120px] left-12 size-80 rounded-full bg-[#fef08a]/40 blur-3xl" />
      </div>
      <PublicNavbar activeHref={pageRouteByTitle[title]} />
      <section className="relative mx-auto max-w-3xl">
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white/80 px-4 text-sm font-bold text-[#007aff] shadow-sm backdrop-blur-xl"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>
        <div className="mt-4 rounded-[36px] border border-white/70 bg-white/78 p-6 shadow-2xl shadow-[#6d5dfc]/15 backdrop-blur-3xl">
          <div className="mb-5 flex items-center gap-3">
            <BrandMark size="md" />
            <div>
              <p className="text-sm font-bold text-[#8e8e93]">{eyebrow}</p>
              <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
            </div>
          </div>
          <p className="text-base font-semibold leading-7 text-[#636366]">{intro}</p>
          <div className="mt-6 space-y-4">{children}</div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white/70 p-4 shadow-lg shadow-black/5">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 text-sm font-semibold leading-6 text-[#636366]">{children}</div>
    </section>
  );
}
