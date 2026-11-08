/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // the service worker must never be cached by the browser, so updates roll out right away
  async headers() {
    return [{ source: "/sw.js", headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ] }];
  },
};

export default nextConfig;
