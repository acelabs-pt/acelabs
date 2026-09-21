"use client";

import { sbBrowser } from "@/lib/supabase-browser";

export default function LogoutButton() {
  async function handleLogout() {
    await sbBrowser().auth.signOut();
    window.location.href = "/cpcv/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      Sair
    </button>
  );
}
