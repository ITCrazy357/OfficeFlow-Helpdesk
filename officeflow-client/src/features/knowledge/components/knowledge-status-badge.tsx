import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

export function KnowledgeStatusBadge({
  isPublished,
}: {
  isPublished: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "motion-badge",
        isPublished
          ? "border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200"
          : "border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200",
      )}
    >
      {isPublished ? "Đã xuất bản" : "Bản nháp"}
    </Badge>
  );
}
