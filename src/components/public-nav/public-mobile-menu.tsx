"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

type PublicNavLink = {
  href: string;
  label: string;
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicMobileMenu({ links }: { links: PublicNavLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-full bg-white/85 text-[#007aff] shadow-sm"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-[calc(100%+0.75rem)] grid gap-2 rounded-[24px] bg-white/90 p-3 shadow-xl shadow-black/10 backdrop-blur-2xl lg:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
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
            <a
              href="/login"
              className="relative z-10 rounded-2xl bg-[#e5f1ff] px-4 py-3 text-center text-sm font-bold text-[#007aff]"
            >
              Log in
            </a>
            <a
              href="/signup"
              className="relative z-10 rounded-2xl bg-[#007aff] px-4 py-3 text-center text-sm font-bold text-white"
            >
              Sign up
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
