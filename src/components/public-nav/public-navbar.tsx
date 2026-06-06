import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { PublicMobileMenu } from "@/components/public-nav/public-mobile-menu";

export const publicNavLinks = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/get-app", label: "Get App" },
  { href: "/help", label: "Help" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function linkClass(href: string, activeHref?: string) {
  const active = activeHref === href;
  return `rounded-full px-4 py-2 text-sm font-bold transition ${
    active
      ? "bg-[#1d1d1f] text-white shadow-lg shadow-black/15"
      : "text-[#636366] hover:bg-white hover:text-[#007aff]"
  }`;
}

export function PublicNavbar({ activeHref }: { activeHref?: string }) {
  return (
    <nav className="sticky top-4 z-30 mx-auto max-w-6xl rounded-[28px] border border-white/65 bg-white/76 p-3 shadow-lg shadow-black/5 backdrop-blur-2xl md:rounded-full md:px-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" aria-label="Arcgenda home">
          <BrandMark size="sm" label />
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          {publicNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href, activeHref)}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <a
            href="/login"
            className="relative z-10 rounded-full bg-white/85 px-4 py-2 text-sm font-bold text-[#007aff] shadow-sm"
          >
            Log in
          </a>
          <a
            href="/signup"
            className="relative z-10 rounded-full bg-[#007aff] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#007aff]/25"
          >
            Sign up
          </a>
        </div>
        <PublicMobileMenu links={publicNavLinks} />
      </div>
    </nav>
  );
}
