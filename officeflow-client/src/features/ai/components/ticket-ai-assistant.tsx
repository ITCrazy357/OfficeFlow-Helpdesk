"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KnowledgeArticleForm } from "@/features/knowledge/components/knowledge-article-form";
import { useCreateKnowledgeArticle } from "@/features/knowledge/hooks";
import {
  toKnowledgeArticlePayload,
  type KnowledgeArticleFormValues,
} from "@/features/knowledge/schemas";
import type { TicketStatus } from "@/features/tickets/types";
import { getApiErrorMessage } from "@/lib/axios";
import { useAiStatus, useGenerateAiDraft } from "../hooks";
import type { AiDraft, AiTask } from "../types";

const taskLabels: Record<AiTask, string> = {
  SUMMARY: "Tóm tắt ticket",
  REPLY: "Gợi ý phản hồi",
  ARTICLE: "Soạn bài kiến thức",
};

type Props = {
  ticketId: number;
  status: TicketStatus;
  commentPending: boolean;
  onUseReply: (content: string) => string | null;
};

export function TicketAiAssistant({
  ticketId,
  status,
  commentPending,
  onUseReply,
}: Props) {
  const availability = useAiStatus();
  const generate = useGenerateAiDraft(ticketId);
  const createArticle = useCreateKnowledgeArticle();
  const request = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savedArticleId, setSavedArticleId] = useState<number | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const resolved = status === "RESOLVED" || status === "CLOSED";
  const busy = generate.isPending || createArticle.isPending;

  async function handleGenerate(task: AiTask) {
    if (request.current || createArticle.isPending) return;
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setFeedback(null);
    try {
      const result = await generate.mutateAsync({
        task,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setDraft(result);
      setContent(result.content);
      setSavedArticleId(null);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          getApiErrorMessage(
            cause,
            "Không tạo được bản nháp. Bạn vẫn có thể soạn thủ công.",
          ),
        );
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  async function handleSaveArticle(values: KnowledgeArticleFormValues) {
    if (busy || savedArticleId || !resolved) return;
    setError(null);
    try {
      const article = await createArticle.mutateAsync({
        ...toKnowledgeArticlePayload(values),
        isPublished: false,
      });
      setSavedArticleId(article.id);
      setFeedback(
        "Đã lưu bản nháp. Kiểm tra lại trong Kho kiến thức trước khi xuất bản.",
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không lưu được bản nháp."));
    }
  }

  return (
    <Card className="min-w-0 shadow-sm" data-testid="ticket-ai-assistant">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          AI hỗ trợ IT
        </CardTitle>
        <CardDescription>
          Khi bạn bấm yêu cầu, nội dung ticket, tối đa 20 bình luận gần nhất và
          bài kiến thức liên quan được gửi tới OpenAI. Không gửi tệp đính kèm.
          Kiểm tra thông tin nhạy cảm trước khi dùng.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 pt-0">
        {availability.isPending ? (
          <p className="text-sm text-muted-foreground">Đang kiểm tra AI…</p>
        ) : null}
        {availability.isError ||
        (availability.data && !availability.data.enabled) ? (
          <div className="grid gap-2 rounded-lg border p-3 text-sm">
            <p>
              {availability.data?.reason === "DISABLED"
                ? "AI chưa được bật trên máy chủ. Bạn vẫn có thể viết bình luận và bài kiến thức thủ công."
                : "AI tạm thời chưa sẵn sàng. Các thao tác thủ công vẫn hoạt động."}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => availability.refetch()}
              disabled={availability.isFetching}
            >
              Kiểm tra lại
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(taskLabels) as AiTask[]).map((task) => (
            <Button
              key={task}
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !availability.data?.enabled ||
                busy ||
                (task === "ARTICLE" && !resolved)
              }
              onClick={() => handleGenerate(task)}
            >
              {generate.isPending && generate.variables?.task === task ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {taskLabels[task]}
            </Button>
          ))}
        </div>
        {!resolved ? (
          <p className="text-xs text-muted-foreground">
            Soạn bài kiến thức khi ticket đã giải quyết hoặc đã đóng.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {feedback ? (
          <p role="status" className="text-sm text-muted-foreground">
            {feedback}
          </p>
        ) : null}
        {draft ? (
          <div className="grid min-w-0 gap-4 border-t pt-4">
            <div>
              <p className="text-sm font-semibold">
                Bản nháp · {taskLabels[draft.task]}
              </p>
              <p className="text-xs text-muted-foreground">
                AI có thể sai. Đọc và sửa trước khi sử dụng. Model:{" "}
                {draft.model}.
              </p>
              {draft.context.truncated ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nội dung đã được rút gọn; đã dùng{" "}
                  {draft.context.includedComments}/{draft.context.totalComments}{" "}
                  bình luận gần nhất. Đối chiếu ticket đầy đủ.
                </p>
              ) : null}
            </div>
            {draft.sources.length ? (
              <div className="grid gap-1 text-sm">
                <p className="font-medium">Bài kiến thức tham khảo</p>
                {draft.sources.map((source) => (
                  <Link
                    className="break-words text-primary underline underline-offset-4"
                    key={source.id}
                    href={`/knowledge?article=${source.id}`}
                  >
                    {source.title}
                  </Link>
                ))}
              </div>
            ) : null}
            {draft.task === "ARTICLE" ? (
              savedArticleId ? (
                <Link
                  className="text-sm text-primary underline"
                  href={`/knowledge?article=${savedArticleId}`}
                >
                  Mở bài kiến thức đã lưu
                </Link>
              ) : (
                <KnowledgeArticleForm
                  key={draft.generatedAt}
                  draftOnly
                  defaultValues={{
                    title: draft.title,
                    summary: draft.summary,
                    content: draft.content,
                  }}
                  submitLabel="Lưu bản nháp kiến thức"
                  isSubmitting={busy || !resolved}
                  onSubmit={handleSaveArticle}
                />
              )
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="ai-draft-content">Nội dung bản nháp</Label>
                <Textarea
                  id="ai-draft-content"
                  className="min-h-48 resize-y"
                  maxLength={15000}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  disabled={busy}
                />
                {draft.task === "REPLY" ? (
                  <Button
                    type="button"
                    className="justify-self-start"
                    disabled={
                      busy || commentPending || content.trim().length < 10
                    }
                    onClick={() => {
                      const message = onUseReply(content.trim());
                      setError(message);
                      setFeedback(
                        message
                          ? null
                          : "Đã thêm vào ô bình luận. Kiểm tra lại rồi bấm Gửi bình luận.",
                      );
                    }}
                  >
                    Thêm vào ô bình luận
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
