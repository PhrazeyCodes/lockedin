import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import ConnectionBanner from "@/components/ConnectionBanner";

export const metadata = {
  title: "LockedIn",
  description: "Social accountability fitness OS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LockedIn",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // required for env(safe-area-inset-*) on iPhone
  themeColor: "#14532d",
};

const RECOVER = `(function(){
  function recover(){
    try { if (sessionStorage.getItem("li-recovered")) return; sessionStorage.setItem("li-recovered","1"); } catch(e) {}
    var p = [];
    if (navigator.serviceWorker) p.push(navigator.serviceWorker.getRegistrations().then(function(rs){ return Promise.all(rs.map(function(r){ return r.unregister(); })); }));
    if (window.caches) p.push(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); }));
    Promise.all(p).catch(function(){}).then(function(){ location.reload(); });
  }
  window.addEventListener("error", function(e){
    var t = e && e.target;
    if (t && (t.tagName === "SCRIPT" || t.tagName === "LINK") && String(t.src || t.href || "").indexOf("/_next/") !== -1) recover();
  }, true);
  window.addEventListener("unhandledrejection", function(e){
    var m = String(e && e.reason && (e.reason.message || e.reason.name) || "");
    if (/ChunkLoadError|Loading chunk|Loading CSS chunk/i.test(m)) recover();
  });
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Safety net, runs before the app's code: if a code file fails to load (e.g. a saved
            copy from an older update), clear the saved app and reload once from the network. */}
        <script dangerouslySetInnerHTML={{ __html: RECOVER }} />
      </head>
      <body>
        <div className="mx-auto max-w-md min-h-screen">{children}</div>
        <RegisterSW />
        <ConnectionBanner />
      </body>
    </html>
  );
}