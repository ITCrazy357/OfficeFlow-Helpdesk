"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OfficeFlowFigure } from "@/components/ui/officeflow-figure";
import { useKnowledgeArticles } from "@/features/knowledge/hooks";
import type { KnowledgeArticle } from "@/features/knowledge/types";
import type { Pagination } from "@/types/api";
import { ArticleCard } from "./knowledge-article-card";

type Props = {
  pagination: Pagination | undefined;
  articlesQuery: ReturnType<typeof useKnowledgeArticles>;
  articles: KnowledgeArticle[];
  selectedArticleId: number | null;
  handleSelectArticle: (articleId: number) => void;
  hasActiveFilter: boolean;
  handleClearFilters: () => void;
};
export function KnowledgeArticleList({
  pagination,
  articlesQuery,
  articles,
  selectedArticleId,
  handleSelectArticle,
  hasActiveFilter,
  handleClearFilters,
}: Props) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Danh sách bài viết</CardTitle>
            <CardDescription>
              {pagination
                ? `${pagination.totalItems} bài viết`
                : "Không có dữ liệu phân trang"}
              {articlesQuery.isFetching ? " / Đang cập nhật" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {articles.length ? (
          <div className="grid gap-3">
            {articles.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                index={index}
                isActive={selectedArticleId === article.id}
                onSelect={() => handleSelectArticle(article.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center px-4 text-center">
            <div className="max-w-md">
              <OfficeFlowFigure kind="loupe" className="mx-auto mb-2 w-36" />
              <p className="font-medium">Chưa có bài viết phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thử đổi từ khóa hoặc tag để mở rộng kết quả tìm kiếm.
              </p>
              {hasActiveFilter ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={handleClearFilters}
                >
                  Xóa bộ lọc
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
