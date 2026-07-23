"use client";
import BottomNav from "@/components/BottomNav";

export default function TabsLayout({ children }) {
  return (
    <>
      <main style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>{children}</main>
      <BottomNav />
    </>
  );
}