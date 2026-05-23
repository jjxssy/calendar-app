"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";

const links = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/get-app", label: "Get App" },
  { href: "/help", label: "Help" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-4 z-30 mx-auto max-w-6xl rounded-[28px] border border-white/65 bg-white/76 p-3 shadow-lg shadow-black/5 backdrop-blur-2xl md:rounded-full md:px-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" aria-label="Arcgenda home">
          <BrandMark size="sm" label />
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                isActive(pathname, link.href)
                  ? "bg-[#1d1d1f] text-white shadow-lg shadow-black/15"
                  : "text-[#636366] hover:bg-white hover:text-[#007aff]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/login"
            className={`rounded-full px-4 py-2 text-sm font-bold shadow-sm ${
              pathname === "/login" ? "bg-[#e5f1ff] text-[#005bb5]" : "bg-white/85 text-[#007aff]"
            }`}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={`rounded-full px-4 py-2 text-sm font-bold shadow-lg ${
              pathname === "/signup"
                ? "bg-[#1d1d1f] text-white shadow-black/15"
                : "bg-[#007aff] text-white shadow-[#007aff]/25"
            }`}
          >
            Sign up
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid size-10 place-items-center rounded-full bg-white/85 text-[#007aff] shadow-sm lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 rounded-[24px] bg-white/72 p-3 shadow-inner shadow-black/5 lg:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                isActive(pathname, link.href)
                  ? "bg-[#1d1d1f] text-white"
                  : "bg-white/68 text-[#636366]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-2xl bg-[#e5f1ff] px-4 py-3 text-center text-sm font-bold text-[#007aff]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="rounded-2xl bg-[#007aff] px-4 py-3 text-center text-sm font-bold text-white"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
