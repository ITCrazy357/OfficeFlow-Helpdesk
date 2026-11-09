"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthUser } from "@/features/auth/types";
import { useKnowledgeArticles } from "@/features/knowledge/hooks";
import { Loader2, Search, Tags } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { PublishedFilter } from "../knowledge-page-types";

type Props = {
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
  tagInput: string;
  setTagInput: Dispatch<SetStateAction<string>>;
  user: AuthUser | undefined;
  publishedFilter: PublishedFilter;
  setPublishedFilter: Dispatch<SetStateAction<PublishedFilter>>;
  setPage: Dispatch<SetStateAction<number>>;
  articlesQuery: ReturnType<typeof useKnowledgeArticles>;
  hasActiveFilter: boolean;
  handleClearFilters: () => void;
};
export function KnowledgeFilters({
  searchInput,
  setSearchInput,
  tagInput,
  setTagInput,
  user,
  publishedFilter,
  setPublishedFilter,
  setPage,
  articlesQuery,
  hasActiveFilter,
  handleClearFilters,
}: Props) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>Tìm kiếm FAQ</CardTitle>
            <CardDescription>
              Lọc theo từ khóa, tag và trạng thái xuất bản nếu có quyền.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 2xl:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Tìm lỗi VPN, email, máy in..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-8"
              placeholder="Tìm lỗi VPN, email, máy in..."
            />
          </div>

          <div className="relative">
            <Tags className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              className="pl-8"
              placeholder="Tag"
            />
          </div>

          {user?.role === "ADMIN" ? (
            <Select
              value={publishedFilter}
              onValueChange={(value) => {
                setPublishedFilter(value as PublishedFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                <SelectItem value="PUBLISHED">Đã xuất bản</SelectItem>
                <SelectItem value="DRAFT">Bản nháp</SelectItem>
              </SelectContent>
            </Select>
          ) : null}

          <div className="flex items-center gap-2">
            {articlesQuery.isFetching ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Đang tìm
              </span>
            ) : null}
            {hasActiveFilter ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                disabled={articlesQuery.isFetching}
              >
                Xóa
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
