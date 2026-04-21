import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goon Squad",
  description: "Time's a goon, right? Track what you read before it slips past.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
