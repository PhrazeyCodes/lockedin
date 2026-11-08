"use client";
import { useEffect, useState } from "react";

// Shown when LockedIn can't reach the server for a while — so you get a clear message
// and a Retry button instead of an endless loading screen.
export default function ConnectionBanner() {
  const [down, setDown] = useState(false);
  useEffect(() => {
    const h = (e) => setDown(!e.detail);
    window.addEventListener("li-conn", h);
    return () => window.removeEventListener("li-conn", h);
  }, []);
  if (!down) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[80] px-3" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
        <span>Can't reach LockedIn — showing what's saved on your phone.</span>
        <button className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900 active:scale-95"
          onClick={() => location.reload()}>Retry</button>
      </div>
    </div>
  );
}
