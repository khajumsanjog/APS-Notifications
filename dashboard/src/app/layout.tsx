import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "APS — Aadhan Pradhan Services Developer Console",
  description: "Self-hosted Pusher & Pusher Beams compatible real-time and push notification infrastructure.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white">{children}</body>
    </html>
  );
}
