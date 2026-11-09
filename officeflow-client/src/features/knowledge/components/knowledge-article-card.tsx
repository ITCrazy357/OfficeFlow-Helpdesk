import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { KnowledgeArticle } from "@/features/knowledge/types";
import { BookOpenText, Eye } from "lucide-react";
import type { CSSProperties } from "react";
import { formatDateTime, parseTags } from "../article-presentation";
import { KnowledgeStatusBadge } from "./knowledge-status-badge";
export function ArticleCard({
  article,
  index,
  isActive,
  onSelect,
}: {
  article: KnowledgeArticle;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const tags = parseTags(article.tags).slice(0, 3);

  return (
    <button
      type="button"
      className={cn(
        "motion-card w-full rounded-lg border bg-card p-4 text-left shadow-sm outline-none transition-colors hover:border-teal-200 hover:bg-teal-50/35",
        isActive &&
          "border-teal-300 dark:border-teal-400/25 bg-teal-50/60 dark:bg-teal-400/10 shadow-teal-950/5",
      )}
      style={{ "--motion-index": index } as CSSProperties}
      onClick={onSelect}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <KnowledgeStatusBadge isPublished={article.isPublished} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="size-3.5" />
              {article.viewCount} lượt xem
            </span>
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">
            {article.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {article.summary || "Chưa có tóm tắt cho bài hướng dẫn này."}
          </p>
        </div>
        <BookOpenText className="size-5 shrink-0 text-teal-800 dark:text-teal-200" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {tags.length ? (
          tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="motion-badge">
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Chưa gắn tag</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatDateTime(article.updatedAt)}
        </span>
      </div>
    </button>
  );
}
