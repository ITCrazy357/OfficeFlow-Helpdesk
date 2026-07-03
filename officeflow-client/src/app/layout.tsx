import { AppQueryClientProvider } from "@/lib/query-client-provider";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfficeFlow Helpdesk",
  description: "OfficeFlow internal helpdesk client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="bg-background text-foreground antialiased">
        <AppQueryClientProvider>{children}</AppQueryClientProvider>
      </body>
    </html>
  );
}
