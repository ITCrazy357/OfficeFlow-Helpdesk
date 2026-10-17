import { cn } from "@/components/ui/utils";

/** Adapted from Uiverse / barisdogansutcu, light-rat-32. See THIRD_PARTY_NOTICES.md. */
export function Loader({ className }: { className?: string }) {
  return <svg className={cn("of-loader size-4 shrink-0", className)} viewBox="25 25 50 50" aria-hidden="true"><circle r="20" cy="50" cx="50" /></svg>;
}
