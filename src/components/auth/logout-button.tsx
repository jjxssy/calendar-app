"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { logout } from "@/lib/api";

export function LogoutButton({ className = "" }: { className?: string }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout("/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className={
        className ||
        "flex h-11 items-center justify-center gap-2 rounded-full bg-[#ff3b30] px-5 text-sm font-black text-white shadow-lg shadow-[#ff3b30]/20 disabled:opacity-60"
      }
    >
      <LogOut size={17} />
      {loggingOut ? "Logging out..." : "Log out"}
    </button>
  );
}
