"use client";
import BottomNav from "@/components/BottomNav";

export default function TabsLayout({ children }) {
  return (
    <>
      <main className="pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
