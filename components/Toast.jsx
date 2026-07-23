"use client";
import { useEffect, useState } from "react";

// Global success feedback: showToast("Logged ✓") from anywhere.
export function showToast(msg) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("li-toast", { detail: msg }));
  }
}

export default function Toaster() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let t;
    const h = (e) => {
      setMsg(e.detail);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 1800);
    };
    window.addEventListener("li-toast", h);
    return () => { window.removeEventListener("li-toast", h); clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return (
    <div className="animate-pop fixed left-1/2 top-4 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-lg"
      style={{ top: "calc(1rem + env(safe-area-inset-top))" }}>
      {msg}
    </div>
  );
}
