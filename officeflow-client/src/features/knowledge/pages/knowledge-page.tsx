"use client";
import { KnowledgeArticleDetails } from "@/features/knowledge/components/knowledge-article-details";
import { KnowledgeArticleEditor } from "@/features/knowledge/components/knowledge-article-editor";
import { KnowledgeArticleList } from "@/features/knowledge/components/knowledge-article-list";
import { KnowledgeFilters } from "@/features/knowledge/components/knowledge-filters";
import type {
  FormMode,
  PublishedFilter,
} from "@/features/knowledge/knowledge-page-types";

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Plus,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { useMe } from "@/features/auth/hooks";
import type { AuthUser } from "@/features/auth/types";
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
const SEARCH_DEBOUNCE_MS = 400;

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

export default function KnowledgePage() {
  return (
    <Suspense fallback={<KnowledgeSkeleton />}>
      <KnowledgeRoute />
    </Suspense>
  );
}

function KnowledgeRoute() {
  const searchParams = useSearchParams();
  const articleId = Number(searchParams.get("articleId"));

  return (
    <KnowledgeContent
      key={searchParams.toString()}
      initialKeyword={searchParams.get("keyword") ?? ""}
      initialTag={searchParams.get("tag") ?? ""}
      initialArticleId={
        Number.isSafeInteger(articleId) && articleId > 0 ? articleId : null
      }
    />
  );
}

function KnowledgeContent({
  initialKeyword,
  initialTag,
  initialArticleId,
}: {
  initialKeyword: string;
  initialTag: string;
  initialArticleId: number | null;
}) {
  const { data: user } = useMe();
  const canManage = canManageKnowledge(user);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(initialKeyword);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [tagInput, setTagInput] = useState(initialTag);
  const [tag, setTag] = useState(initialTag);
  const [publishedFilter, setPublishedFilter] =
    useState<PublishedFilter>("ALL");
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(
    initialArticleId,
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextKeyword = searchInput.trim();
      const nextTag = tagInput.trim();

      if (nextKeyword !== keyword || nextTag !== tag) {
        setPage(1);
        setKeyword(nextKeyword);
        setTag(nextTag);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [keyword, searchInput, tag, tagInput]);

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
      setFormError(getApiErrorMessage(error, "Không thể xuất bản bài viết."));
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
          <h1 className="text-2xl font-semibold tracking-normal">
            Trung tâm trợ giúp
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tìm hướng dẫn xử lý nhanh, FAQ nội bộ và các bài viết đã được xác
            thực.
          </p>
        </div>

        {canManage ? (
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5 self-start">
          <KnowledgeFilters
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            tagInput={tagInput}
            setTagInput={setTagInput}
            user={user}
            publishedFilter={publishedFilter}
            setPublishedFilter={setPublishedFilter}
            setPage={setPage}
            articlesQuery={articlesQuery}
            hasActiveFilter={hasActiveFilter}
            handleClearFilters={handleClearFilters}
          />

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
            <KnowledgeArticleList
              pagination={pagination}
              articlesQuery={articlesQuery}
              articles={articles}
              selectedArticleId={selectedArticleId}
              handleSelectArticle={handleSelectArticle}
              hasActiveFilter={hasActiveFilter}
              handleClearFilters={handleClearFilters}
            />
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
            <KnowledgeArticleEditor
              formMode={formMode}
              detailQuery={detailQuery}
              selectedArticle={selectedArticle}
              createArticle={createArticle}
              updateArticle={updateArticle}
              formError={formError}
              setFormMode={setFormMode}
              setFormError={setFormError}
              handleFormSubmit={handleFormSubmit}
            />
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
              <KnowledgeArticleDetails
                selectedArticle={selectedArticle}
                formError={formError}
                deleteError={deleteError}
                selectedCanMutate={selectedCanMutate}
                setFormMode={setFormMode}
                setFormError={setFormError}
                handlePublish={handlePublish}
                publishArticle={publishArticle}
                setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
                deleteArticle={deleteArticle}
                isDeleteConfirmOpen={isDeleteConfirmOpen}
                handleDelete={handleDelete}
              />
            )
          ) : (
            <Card className="shadow-sm motion-panel">
              <CardContent className="grid min-h-80 place-items-center px-6 py-10 text-center">
                <div>
                  <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-200">
                    <FileQuestion className="size-5" />
                  </div>
                  <p className="font-semibold">Chọn một bài viết</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Nội dung chi tiết, tag và quyền thao tác sẽ hiển thị tại
                    đây.
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
