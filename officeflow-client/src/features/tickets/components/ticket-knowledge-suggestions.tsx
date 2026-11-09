"use client";

import type { CSSProperties } from "react";
import { BookOpenText, Eye, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { KnowledgeSuggestion } from "@/features/knowledge/types";
import { parseKnowledgeTags } from "../ticket-detail.utils";

type TicketKnowledgeSuggestionsProps = {
  articles: KnowledgeSuggestion[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function TicketKnowledgeSuggestions({
  articles,
  isLoading,
  isError,
  onRetry,
}: TicketKnowledgeSuggestionsProps) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <BookOpenText className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>Gợi ý Knowledge Base</CardTitle>
            <CardDescription>
              Bài viết liên quan đến nội dung ticket.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 rounded-lg bg-muted motion-shimmer"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">
              Không thể tải bài viết gợi ý.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              Thử lại
            </Button>
          </div>
        ) : articles.length ? (
          <div className="grid gap-3">
            {articles.map((article, index) => (
              <Link
                key={article.id}
                href={`/knowledge?articleId=${article.id}`}
                className="motion-card rounded-lg border bg-muted/20 p-3 transition-colors hover:border-teal-200 hover:bg-teal-50/50"
                style={{ "--motion-index": index } as CSSProperties}
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-950/5 dark:bg-teal-200/10 text-teal-950 dark:text-teal-200">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">
                      {article.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {article.summary ?? "Mở bài viết để xem chi tiết."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="motion-badge">
                        <Eye className="size-3.5" />
                        {article.viewCount}
                      </Badge>
                      {parseKnowledgeTags(article.tags)
                        .slice(0, 2)
                        .map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="motion-badge"
                          >
                            {tag}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <BookOpenText className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Chưa có bài viết phù hợp</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Thêm bài FAQ để hệ thống gợi ý nhanh hơn cho ticket sau.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
