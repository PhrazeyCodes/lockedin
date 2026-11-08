"use client";
import { useEffect, useState } from "react";
import { resetApp } from "@/lib/resetApp";

// Shown instead of Next's blank "Application error" — tells you what broke and gives you a
// way out. The error text is shown small so it can be screenshotted for debugging.
export default function CrashScreen({ error, reset }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { console.error(error); }, [error]);
  const where = typeof location !== "undefined" ? location.pathname : "";
  const detail = `${error?.name || "Error"}: ${error?.message || "unknown"}\n@ ${where}\n${String(error?.stack || "").split("\n").slice(0, 4).join("\n")}`;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="mt-1 text-sm text-gray-500">Your data is safe — it's saved to your account.</p>
      <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
        <button className="btn-primary w-full" onClick={() => (reset ? reset() : location.reload())}>Try again</button>
        <button className="btn-ghost w-full" disabled={busy} onClick={() => { setBusy(true); resetApp(); }}>
          {busy ? "Resetting…" : "Reset app & sign in again"}
        </button>
      </div>
      <pre className="mt-6 max-h-48 w-full max-w-sm overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-100 p-3 text-left text-[10px] text-gray-500">{detail}</pre>
    </div>
  );
}
