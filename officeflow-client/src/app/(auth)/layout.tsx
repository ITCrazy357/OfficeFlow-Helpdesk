import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <><div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6"><ThemeToggle /></div>{children}</>;
}
