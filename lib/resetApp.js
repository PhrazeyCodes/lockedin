// Clears everything LockedIn keeps on this device (saved app copy, caches, sign-in) and
// goes to the login screen. Your workouts, journal etc. live in your account and are untouched.
export async function resetApp() {
  try {
    if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch {}
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  location.replace("/login");
}
