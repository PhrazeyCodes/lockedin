"use client";

// Generic bottom sheet
export default function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-slideup relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto no-scrollbar">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
        {title && <h2 className="mb-4 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
