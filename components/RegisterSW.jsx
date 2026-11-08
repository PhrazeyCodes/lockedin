"use client";
import { useEffect } from "react";

// Installs the service worker (public/sw.js) so the app's own files are kept on the phone.
export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    const go = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
  }, []);
  return null;
}
