"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BookOpenText, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKnowledgeArticle, useSuggestKnowledgeArticles } from "../hooks";
import { getApiErrorMessage } from "@/lib/axios";

type TicketSelfServiceProps = {
  title: string;
  description: string;
  disabled: boolean;
  resolvedArticle: string | null;
  onResolved: (articleTitle: string) => void;
  onContinue: () => void;
};

export function TicketSelfService({
  title,
  description,
  disabled,
  resolvedArticle,
  onResolved,
  onContinue,
}: TicketSelfServiceProps) {
  const previewId = useId();
  const previewRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<{
    articleId: number;
    title: string;
    description: string;
  } | null>(null);
  const selectedId =
    selection?.title === title && selection?.description === description
      ? selection.articleId
      : null;
  const [search, setSearch] = useState({ title: "", description: "" });
  useEffect(() => {
    const timer = window.setTimeout(
      () => setSearch({ title, description }),
      450,
    );
    return () => window.clearTimeout(timer);
  }, [title, description]);
  useEffect(() => {
    if (selectedId !== null) previewRef.current?.focus();
  }, [selectedId]);

  const isTyping = search.title !== title || search.description !== description;
  const hasText = title.trim().length >= 3 || description.trim().length >= 3;
  const suggestions = useSuggestKnowledgeArticles(
    search,
    hasText && !isTyping && !disabled && !resolvedArticle,
  );
  const detail = useKnowledgeArticle(selectedId ?? 0, selectedId !== null);
  const article = detail.data;
  const canRead = !detail.isError && !detail.isFetching && article?.isPublished;

  function closePreview() {
    document.getElementById(`${previewId}-article-${selectedId}`)?.focus();
    setSelection(null);
  }

  if (resolvedArticle) {
    return (
      <section
        aria-label="Kết quả tự xử lý"
        className="grid gap-3 rounded-lg border bg-muted/25 p-4"
        role="status"
      >
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4 shrink-0" />
          Vấn đề đã được giải quyết
        </p>
        <p className="break-words text-sm text-muted-foreground">
          Bạn đã tự xử lý theo bài “{resolvedArticle}”. Chưa có ticket nào được
          tạo.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={onContinue}
          disabled={disabled}
        >
          Vẫn cần hỗ trợ
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label="Gợi ý tự xử lý"
      className="grid min-w-0 gap-3 rounded-lg border bg-muted/20 p-4"
    >
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpenText className="size-4 shrink-0" />
          Thử tự xử lý trước khi gửi
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Bài hướng dẫn được tìm theo tiêu đề và mô tả. Bạn luôn có thể tiếp tục
          tạo ticket.
        </p>
      </div>
      <div aria-live="polite" className="text-sm">
        {!hasText ? (
          <p className="text-muted-foreground">
            Nhập ít nhất 3 ký tự ở tiêu đề hoặc mô tả để tìm hướng dẫn.
          </p>
        ) : isTyping || suggestions.isFetching ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Đang tìm hướng dẫn...
          </p>
        ) : suggestions.isError ? (
          <div className="grid gap-2">
            <p className="text-muted-foreground">
              Không thể tải gợi ý. Bạn vẫn có thể gửi ticket.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => suggestions.refetch()}
              disabled={disabled}
            >
              Thử lại gợi ý
            </Button>
          </div>
        ) : suggestions.data?.length ? (
          <ul className="grid gap-2">
            {suggestions.data.map((item) => (
              <li
                key={item.id}
                className="min-w-0 rounded-lg border bg-card p-3"
              >
                <button
                  type="button"
                  id={`${previewId}-article-${item.id}`}
                  className="w-full break-words text-left text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() =>
                    setSelection({ articleId: item.id, title, description })
                  }
                  disabled={disabled}
                  aria-expanded={selectedId === item.id}
                  aria-controls={selectedId === item.id ? previewId : undefined}
                >
                  {item.title}
                </button>
                {item.summary ? (
                  <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                    {item.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            Chưa tìm thấy hướng dẫn phù hợp. Hãy tiếp tục tạo ticket để đội hỗ
            trợ xử lý.
          </p>
        )}
      </div>
      {selectedId !== null ? (
        <section
          id={previewId}
          ref={previewRef}
          tabIndex={-1}
          aria-label="Nội dung hướng dẫn"
          className="grid min-w-0 gap-3 border-t pt-4 outline-none"
        >
          {detail.isLoading || detail.isFetching ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Đang mở hướng dẫn...
            </p>
          ) : !canRead ? (
            <div className="grid gap-2" role="alert">
              <p className="break-words text-sm text-muted-foreground">
                {detail.isError
                  ? getApiErrorMessage(
                      detail.error,
                      "Không thể mở hướng dẫn. Bạn vẫn có thể tạo ticket.",
                    )
                  : "Hướng dẫn không còn được xuất bản. Bạn vẫn có thể tạo ticket."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => detail.refetch()}
                disabled={disabled}
              >
                Thử mở lại
              </Button>
            </div>
          ) : (
            <>
              <h3 className="break-words text-base font-semibold">
                {article.title}
              </h3>
              <p className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-card p-3 text-sm leading-7">
                {article.content}
              </p>
            </>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canRead ? (
              <Button
                type="button"
                onClick={() => {
                  onResolved(article.title);
                  setSelection(null);
                }}
                disabled={disabled}
              >
                <CheckCircle2 className="size-4" />
                Đã giải quyết
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={closePreview}>
              Tiếp tục nhập ticket
            </Button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
