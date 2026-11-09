"use client";

import type { CSSProperties } from "react";
import { Loader2, MessageSquareText, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "../ticket-detail.utils";
import type { TicketComment } from "../types";

type TicketDiscussionProps = {
  comments: TicketComment[];
  content: string;
  onContentChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function TicketDiscussion({
  comments,
  content,
  onContentChange,
  onSubmit,
  isSubmitting,
  error,
  isLoading,
  isError,
  onRetry,
}: TicketDiscussionProps) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>Trao đổi</CardTitle>
            <CardDescription>
              Ghi nhận thêm thông tin xử lý cho ticket này.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3">
          <Textarea
            id="ticket-comment-content"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            placeholder="Nhập cập nhật xử lý, thông tin đã kiểm tra hoặc câu hỏi cần làm rõ"
            disabled={isSubmitting}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Tối thiểu 10 ký tự.</p>
            <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
              Gửi bình luận
            </Button>
          </div>
          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-20 rounded-lg bg-muted motion-shimmer"
              />
            ))
          ) : isError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                Không thể tải bình luận.
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
          ) : comments.length ? (
            comments.map((comment, index) => (
              <div
                key={comment.id}
                className="motion-card rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/35"
                style={{ "--motion-index": index } as CSSProperties}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold">{comment.author.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(comment.createdAt)}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {comment.content}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-5 text-center">
              <MessageSquareText className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Chưa có bình luận</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Gửi cập nhật đầu tiên để lưu lại trao đổi xử lý.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
