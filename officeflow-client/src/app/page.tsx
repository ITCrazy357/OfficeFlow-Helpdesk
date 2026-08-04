"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { restoreSessionApi } from "@/features/auth/api";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void restoreSessionApi()
      .then(() => {
        if (active) router.replace("/dashboard");
      })
      .catch(() => {
        if (active) router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm motion-panel">
        Đang chuyển hướng...
      </div>
    </main>
  );
}
