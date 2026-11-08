"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { showToast } from "./Toast";
import { supabase } from "@/lib/supabase";
import {
  PROOF_KINDS, postProofShot, shrinkPhoto, recordSkip, turnOff, cacheProofPrefsFromAccount,
} from "@/lib/proof";

// The "snap proof" card. Mounted once in the tabs layout; opened by askForProof().
// Camera-only on purpose (capture="environment"): proof is taken now, not pulled
// from the camera roll — that's what earns the "live" badge in the feed.
export default function ProofPrompt() {
  const [ask, setAsk] = useState(null);      // { kind, title, subtitle }
  const [shot, setShot] = useState(null);    // { blob, url }
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    // pick up prompt settings saved from another device
    supabase.auth.getSession().then(({ data }) => cacheProofPrefsFromAccount(data?.session?.user?.user_metadata));
    const h = (e) => { setAsk(e.detail); setShot(null); setCaption(""); setError(""); };
    window.addEventListener("li-proof", h);
    return () => window.removeEventListener("li-proof", h);
  }, []);

  if (!ask) return null;
  const meta = PROOF_KINDS[ask.kind] || { chip: "Proof", icon: "camera" };

  function close() { if (shot?.url) URL.revokeObjectURL(shot.url); setAsk(null); setShot(null); }

  async function onFile(file) {
    if (!file) return;
    setBusy(true);
    const blob = await shrinkPhoto(file);
    setShot({ blob, url: URL.createObjectURL(blob) });
    setBusy(false);
  }

  async function post() {
    setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      await postProofShot(data.session.user.id, { kind: ask.kind, blob: shot.blob, caption });
      showToast("Posted to your feed");
      close();
    } catch (e) { setError(e.message || "Couldn't post — try again"); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-x-0 z-50 px-3"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
      <div className="animate-pop mx-auto max-w-md rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5">
        {!shot ? (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lock text-white">
                <Icon name="camera" className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{ask.title || "Snap proof?"}</p>
                <p className="mt-0.5 text-[12px] text-gray-500">{ask.subtitle || "Post a quick shot so your friends see it live."}</p>
              </div>
              <button aria-label="Close" className="p-1 text-gray-300" onClick={() => { recordSkip(ask.kind); close(); }}>
                <Icon name="x" className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex flex-1 items-center justify-center gap-2" disabled={busy}
                onClick={() => inputRef.current?.click()}>
                <Icon name="camera" className="h-4 w-4" /> {busy ? "Processing…" : "Snap it"}
              </button>
              <button className="btn-ghost px-4" onClick={() => { recordSkip(ask.kind); close(); }}>Skip</button>
            </div>
            <button className="mt-2 w-full text-center text-[11px] text-gray-400"
              onClick={async () => { await turnOff(ask.kind); showToast(`Won't ask after ${meta.chip.toLowerCase()} logs`); close(); }}>
              Don't ask for {PROOF_KINDS[ask.kind]?.label.toLowerCase() || "this"} · change in Settings
            </button>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </>
        ) : (
          <>
            <div className="relative">
              <img src={shot.url} alt="" className="max-h-72 w-full rounded-2xl object-cover" />
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <Icon name={meta.icon} className="h-3 w-3" /> {meta.chip}
              </span>
            </div>
            <input className="input mt-3" placeholder="Caption (optional)" value={caption}
              onChange={(e) => setCaption(e.target.value)} />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1" disabled={busy} onClick={post}>{busy ? "Posting…" : "Post"}</button>
              <button className="btn-ghost px-4" disabled={busy} onClick={() => inputRef.current?.click()}>Retake</button>
            </div>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </>
        )}
      </div>
    </div>
  );
}
