"use client";
import CrashScreen from "@/components/CrashScreen";
export default function Error({ error, reset }) { return <CrashScreen error={error} reset={reset} />; }
