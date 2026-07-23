"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileQuestion,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/components/ui/utils";
import { useMe } from "@/features/auth/hooks";
import type { AuthUser } from "@/features/auth/types";
import { KnowledgeArticleForm } from "@/features/knowledge/components/knowledge-article-form";
import {
  useCreateKnowledgeArticle,
  useDeleteKnowledgeArticle,
  useKnowledgeArticle,
  useKnowledgeArticles,
  usePublishKnowledgeArticle,
  useUpdateKnowledgeArticle,
} from "@/features/knowledge/hooks";
import {
  toKnowledgeArticlePayload,
  type KnowledgeArticleFormValues,
} from "@/features/knowledge/schemas";
import type {
  GetKnowledgeArticlesParams,
  KnowledgeArticle,
  KnowledgeArticleDetail,
} from "@/features/knowledge/types";
import { getApiErrorMessage } from "@/lib/axios";

const PAGE_SIZE = 8;

type PublishedFilter = "ALL" | "PUBLISHED" | "DRAFT";
type FormMode = "create" | "edit" | null;

function getInitialSearchParam(name: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(name) ?? "";
}

function getInitialArticleId() {
  const value = Number(getInitialSearchParam("articleId"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseTags(tags?: string | null) {
  return (
    tags
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}

function canManageKnowledge(user: AuthUser | undefined) {
  return user?.role === "ADMIN" || user?.role === "IT_STAFF";
}

function canMutateArticle(
  user: AuthUser | undefined,
  article?: KnowledgeArticle | KnowledgeArticleDetail,
) {
  if (!user || !article) {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  return user.role === "IT_STAFF" && article.createdBy?.id === user.id;
}

function KnowledgeStatusBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "motion-badge",
        isPublished
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {isPublished ? "Đã xuất bản" : "Bản nháp"}
    </Badge>
  );
}

function KnowledgeSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-0">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-lg bg-muted motion-shimmer"
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="flex items-start gap-3 pt-0">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <div className="grid gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{message}</CardDescription>
          </div>
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              Thử lại
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ArticleCard({
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
        isActive && "border-teal-300 bg-teal-50/60 shadow-teal-950/5",
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
        <BookOpenText className="size-5 shrink-0 text-teal-800" />
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

export default function KnowledgePage() {
  const { data: user } = useMe();
  const canManage = canManageKnowledge(user);
  const initialKeyword = getInitialSearchParam("keyword");
  const initialTag = getInitialSearchParam("tag");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(initialKeyword);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [tagInput, setTagInput] = useState(initialTag);
  const [tag, setTag] = useState(initialTag);
  const [publishedFilter, setPublishedFilter] =
    useState<PublishedFilter>("ALL");
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(
    getInitialArticleId,
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const params = useMemo<GetKnowledgeArticlesParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      keyword: keyword || undefined,
      tag: tag || undefined,
      isPublished:
        user?.role === "ADMIN" && publishedFilter !== "ALL"
          ? publishedFilter === "PUBLISHED"
          : undefined,
    }),
    [keyword, page, publishedFilter, tag, user?.role],
  );

  const articlesQuery = useKnowledgeArticles(params);
  const detailQuery = useKnowledgeArticle(
    selectedArticleId ?? 0,
    Boolean(selectedArticleId),
  );
  const createArticle = useCreateKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();
  const publishArticle = usePublishKnowledgeArticle();
  const deleteArticle = useDeleteKnowledgeArticle();

  const articles = articlesQuery.data?.items ?? [];
  const pagination = articlesQuery.data?.pagination;
  const selectedArticle = detailQuery.data;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const currentPage = pagination?.page ?? page;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const hasActiveFilter =
    Boolean(keyword) ||
    Boolean(tag) ||
    (user?.role === "ADMIN" && publishedFilter !== "ALL");
  const selectedCanMutate = canMutateArticle(user, selectedArticle);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setKeyword(searchInput.trim());
    setTag(tagInput.trim());
  }

  function handleClearFilters() {
    setSearchInput("");
    setKeyword("");
    setTagInput("");
    setTag("");
    setPublishedFilter("ALL");
    setPage(1);
  }

  function handleSelectArticle(articleId: number) {
    setSelectedArticleId(articleId);
    setFormMode(null);
    setFormError(null);
    setDeleteError(null);
    setIsDeleteConfirmOpen(false);
  }

  async function handleFormSubmit(values: KnowledgeArticleFormValues) {
    setFormError(null);

    try {
      if (formMode === "create") {
        const article = await createArticle.mutateAsync(
          toKnowledgeArticlePayload(values),
        );
        setSelectedArticleId(article.id);
      } else if (formMode === "edit" && selectedArticleId) {
        const article = await updateArticle.mutateAsync({
          id: selectedArticleId,
          input: toKnowledgeArticlePayload(values),
        });
        setSelectedArticleId(article.id);
      }

      setFormMode(null);
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "Không thể lưu bài viết. Vui lòng thử lại."),
      );
    }
  }

  async function handlePublish() {
    if (!selectedArticleId) {
      return;
    }

    setFormError(null);

    try {
      await publishArticle.mutateAsync(selectedArticleId);
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "Không thể xuất bản bài viết."),
      );
    }
  }

  async function handleDelete() {
    if (!selectedArticleId) {
      return;
    }

    setDeleteError(null);

    try {
      await deleteArticle.mutateAsync(selectedArticleId);
      setSelectedArticleId(null);
      setFormMode(null);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      setDeleteError(getApiErrorMessage(error, "Không thể xóa bài viết."));
    }
  }

  return (
    <div className="grid gap-6 motion-enter">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            Knowledge Base
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Trung tâm trợ giúp
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tìm hướng dẫn xử lý nhanh, FAQ nội bộ và các bài viết đã được xác thực.
          </p>
        </div>

        {canManage ? (
          <Button
            type="button"
            className="bg-teal-950 hover:bg-teal-900"
            onClick={() => {
              setFormMode("create");
              setSelectedArticleId(null);
              setFormError(null);
              setDeleteError(null);
            }}
          >
            <Plus className="size-4" />
            Tạo bài viết
          </Button>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5 self-start">
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
              <form
                className="grid gap-3 xl:grid-cols-[1fr_180px_190px_auto]"
                onSubmit={handleSearch}
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
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

                <div className="flex gap-2">
                  <Button type="submit" disabled={articlesQuery.isFetching}>
                    Tìm
                  </Button>
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
              </form>
            </CardContent>
          </Card>

          {articlesQuery.isLoading ? (
            <KnowledgeSkeleton />
          ) : articlesQuery.isError ? (
            <ErrorCard
              title="Không thể tải Knowledge Base"
              message={getApiErrorMessage(
                articlesQuery.error,
                "Không thể tải danh sách bài viết.",
              )}
              onRetry={() => articlesQuery.refetch()}
            />
          ) : (
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
                      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
                        <Inbox className="size-5" />
                      </div>
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
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Trang {currentPage} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                disabled={!canGoPrevious || articlesQuery.isFetching}
              >
                <ChevronLeft className="size-4" />
                Trước
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((value) => value + 1)}
                disabled={!canGoNext || articlesQuery.isFetching}
              >
                Sau
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <aside className="grid gap-4 self-start lg:sticky lg:top-24">
          {formMode ? (
            <Card className="shadow-sm motion-panel">
              <CardHeader className="border-b">
                <CardTitle>
                  {formMode === "create" ? "Tạo bài viết" : "Sửa bài viết"}
                </CardTitle>
                <CardDescription>
                  Nội dung càng rõ thì nhân viên càng tự xử lý nhanh hơn.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {formMode === "edit" && detailQuery.isLoading ? (
                  <div className="grid gap-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-12 rounded-lg bg-muted motion-shimmer"
                      />
                    ))}
                  </div>
                ) : (
                  <KnowledgeArticleForm
                    key={
                      formMode === "edit"
                        ? selectedArticle?.id ?? "edit"
                        : "create"
                    }
                    defaultValues={
                      formMode === "edit" && selectedArticle
                        ? {
                            title: selectedArticle.title,
                            summary: selectedArticle.summary ?? "",
                            content: selectedArticle.content,
                            tags: selectedArticle.tags ?? "",
                            isPublished: selectedArticle.isPublished,
                          }
                        : undefined
                    }
                    submitLabel={
                      formMode === "create" ? "Tạo bài viết" : "Lưu thay đổi"
                    }
                    isSubmitting={
                      createArticle.isPending || updateArticle.isPending
                    }
                    error={formError}
                    onCancel={() => {
                      setFormMode(null);
                      setFormError(null);
                    }}
                    onSubmit={handleFormSubmit}
                  />
                )}
              </CardContent>
            </Card>
          ) : selectedArticleId ? (
            detailQuery.isLoading ? (
              <Card className="shadow-sm">
                <CardContent className="grid gap-3 pt-0">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-12 rounded-lg bg-muted motion-shimmer"
                    />
                  ))}
                </CardContent>
              </Card>
            ) : detailQuery.isError || !selectedArticle ? (
              <ErrorCard
                title="Không thể tải bài viết"
                message={getApiErrorMessage(
                  detailQuery.error,
                  "Không thể tải chi tiết bài viết.",
                )}
                onRetry={() => detailQuery.refetch()}
              />
            ) : (
              <Card className="shadow-sm motion-panel">
                <CardHeader className="border-b">
                  <div className="flex flex-wrap items-center gap-2">
                    <KnowledgeStatusBadge
                      isPublished={selectedArticle.isPublished}
                    />
                    <Badge variant="outline" className="motion-badge">
                      <Eye className="size-3.5" />
                      {selectedArticle.viewCount} lượt xem
                    </Badge>
                  </div>
                  <CardTitle className="mt-3 text-xl leading-snug">
                    {selectedArticle.title}
                  </CardTitle>
                  <CardDescription>
                    {selectedArticle.summary ||
                      "Bài viết này chưa có phần tóm tắt."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 pt-0">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                      {selectedArticle.content}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {parseTags(selectedArticle.tags).length ? (
                      parseTags(selectedArticle.tags).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="motion-badge"
                        >
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">Chưa có tag</Badge>
                    )}
                  </div>

                  <div className="grid gap-3 rounded-lg border bg-card p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Người tạo</span>
                      <span className="font-medium">
                        {selectedArticle.createdBy?.name ?? "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Cập nhật</span>
                      <span className="font-medium">
                        {formatDateTime(selectedArticle.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {formError ? (
                    <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
                      {formError}
                    </div>
                  ) : null}

                  {deleteError ? (
                    <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
                      {deleteError}
                    </div>
                  ) : null}

                  {selectedCanMutate ? (
                    <div className="grid gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setFormMode("edit");
                            setFormError(null);
                          }}
                        >
                          <Pencil className="size-4" />
                          Sửa
                        </Button>
                        {!selectedArticle.isPublished ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handlePublish}
                            disabled={publishArticle.isPending}
                          >
                            {publishArticle.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            Xuất bản
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() =>
                            setIsDeleteConfirmOpen((value) => !value)
                          }
                          disabled={deleteArticle.isPending}
                        >
                          <Trash2 className="size-4" />
                          Xóa
                        </Button>
                      </div>

                      {isDeleteConfirmOpen ? (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 motion-toast">
                          <p className="text-sm font-medium text-destructive">
                            Xóa bài viết này khỏi Knowledge Base?
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setIsDeleteConfirmOpen(false)}
                              disabled={deleteArticle.isPending}
                            >
                              Hủy
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={handleDelete}
                              disabled={deleteArticle.isPending}
                            >
                              {deleteArticle.isPending
                                ? "Đang xóa..."
                                : "Xác nhận"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          ) : (
            <Card className="shadow-sm motion-panel">
              <CardContent className="grid min-h-80 place-items-center px-6 py-10 text-center">
                <div>
                  <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
                    <FileQuestion className="size-5" />
                  </div>
                  <p className="font-semibold">Chọn một bài viết</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Nội dung chi tiết, tag và quyền thao tác sẽ hiển thị tại đây.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
