"use client";
import "./globals.css";
import CrashScreen from "@/components/CrashScreen";
export default function GlobalError({ error }) {
  return (
    <html lang="en"><body><CrashScreen error={error} /></body></html>
  );
}
