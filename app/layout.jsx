import "./globals.css";

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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-md min-h-screen">{children}</div>
      </body>
    </html>
  );
}