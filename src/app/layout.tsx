import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Goon Squad",
  description: "Time's a goon, right? Track what you read before it slips past.",
  applicationName: "Goon Squad",
  appleWebApp: {
    capable: true,
    title: "Goon Squad",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/192", sizes: "192x192", type: "image/png" },
      { url: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/180", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#FAF7F1",
};

// Applies the saved (or system) theme before first paint, so there's no flash
// of the wrong colours on load. Mirrors the logic in ThemeToggle.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
