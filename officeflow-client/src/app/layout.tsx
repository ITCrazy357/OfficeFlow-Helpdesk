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
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t;try{t=localStorage.getItem('officeflow-theme')}catch(e){}document.documentElement.classList.toggle('dark',t==='dark'||(t!=='light'&&t!=='dark'&&matchMedia('(prefers-color-scheme: dark)').matches))})()` }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <AppQueryClientProvider>{children}</AppQueryClientProvider>
      </body>
    </html>
  );
}
