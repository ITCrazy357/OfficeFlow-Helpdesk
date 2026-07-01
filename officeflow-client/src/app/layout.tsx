import type { Metadata } from "next";
import { AppProviders } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfficeFlow Helpdesk",
  description: "Helpdesk ticket management workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-[100dvh] bg-zinc-100 text-zinc-950">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
