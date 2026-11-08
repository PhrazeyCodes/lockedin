"use client";
import { useEffect } from "react";
import { resetApp } from "@/lib/resetApp";

// Visit /reset in Safari to wipe LockedIn's saved copy + sign-in on this device.
export default function Reset() {
  useEffect(() => { resetApp(); }, []);
  return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Resetting LockedIn…</div>;
}
