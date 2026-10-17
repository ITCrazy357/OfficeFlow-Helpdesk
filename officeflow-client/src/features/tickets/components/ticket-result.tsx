"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
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
import {
  ticketFeedbackError,
  useRespondToTicket,
  useTicketFeedback,
  validateTicketRating,
} from "../feedback";
import type { Ticket } from "../types";

export function TicketResult({
  ticket,
  isRequester,
}: {
  ticket: Ticket;
  isRequester: boolean;
}) {
  const feedback = useTicketFeedback(ticket.id);
  const response = useRespondToTicket(ticket.id);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function respond(action: "confirm" | "reopen") {
    setError(null);
    setSuccess(null);
    if (action === "reopen" && reason.trim().length < 5) {
      setError("Nêu lý do cần xử lý tiếp, ít nhất 5 ký tự.");
      return;
    }
    try {
      const resolutionVersion = ticket.resolutionVersion ?? 0;
      await response.mutateAsync(
        action === "reopen"
          ? { action, resolutionVersion, reason: reason.trim() }
          : { action, resolutionVersion },
      );
      setReason("");
      setSuccess(
        action === "confirm"
          ? "Đã xác nhận kết quả. Bạn có thể đánh giá hỗ trợ bên dưới."
          : "Đã yêu cầu đội hỗ trợ xử lý tiếp.",
      );
    } catch (failure) {
      setError(
        ticketFeedbackError(
          failure,
          "Không thể gửi phản hồi. Vui lòng tải lại và thử lại.",
        ),
      );
    }
  }

  async function rate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    const validation = validateTicketRating(score, comment);
    setError(validation);
    if (validation) return;
    try {
      await response.mutateAsync({
        action: "feedback",
        score,
        comment: comment.trim() || undefined,
      });
      setSuccess("Đã ghi nhận đánh giá của bạn.");
    } catch (failure) {
      setError(ticketFeedbackError(failure, "Không thể gửi đánh giá."));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5" />
          Kết quả hỗ trợ
        </CardTitle>
        <CardDescription>
          {ticket.status === "RESOLVED"
            ? "Đội hỗ trợ đã xử lý xong. Người gửi xác nhận kết quả hoặc yêu cầu xử lý tiếp."
            : "Đánh giá được lưu một lần cho mỗi ticket sau khi đóng."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {ticket.status === "RESOLVED" && isRequester ? (
          <div className="grid gap-3">
            <Button
              type="button"
              disabled={response.isPending}
              onClick={() => respond("confirm")}
            >
              Xác nhận đã giải quyết
            </Button>
            <Label htmlFor="ticket-reopen-reason">
              Vẫn cần hỗ trợ? Nêu lý do
            </Label>
            <Textarea
              id="ticket-reopen-reason"
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={response.isPending}
            />
            <Button
              type="button"
              variant="outline"
              disabled={response.isPending}
              onClick={() => respond("reopen")}
            >
              Yêu cầu xử lý tiếp
            </Button>
          </div>
        ) : null}
        {feedback.isError ? (
          <div role="alert" className="grid gap-2 text-sm text-destructive">
            Không thể tải đánh giá.
            <Button variant="outline" onClick={() => feedback.refetch()}>
              Thử tải đánh giá
            </Button>
          </div>
        ) : feedback.isPending ? (
          <p className="text-sm text-muted-foreground">Đang tải đánh giá...</p>
        ) : feedback.data ? (
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-4">
            <p className="font-semibold">
              Đánh giá: {feedback.data.score}/5 sao
            </p>
            {feedback.data.comment ? (
              <p className="whitespace-pre-wrap break-words text-sm">
                {feedback.data.comment}
              </p>
            ) : null}
          </div>
        ) : ticket.status === "CLOSED" && isRequester ? (
          <form
            aria-label="Đánh giá hỗ trợ"
            className="grid gap-3"
            onSubmit={rate}
          >
            <fieldset disabled={response.isPending} className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Mức hài lòng</legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-1 rounded-md border p-2 has-checked:border-primary has-checked:bg-primary/10 focus-within:ring-2 focus-within:ring-ring"
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="support-score"
                      value={value}
                      checked={score === value}
                      onChange={() => setScore(value)}
                    />
                    <Star
                      aria-hidden="true"
                      className={`size-4 ${score >= value ? "fill-primary text-primary" : "text-muted-foreground"}`}
                    />
                    <span>{value} sao</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Label htmlFor="ticket-rating-comment">
              Nhận xét{" "}
              {score > 0 && score <= 2 ? "(bắt buộc)" : "(không bắt buộc)"}
            </Label>
            <Textarea
              id="ticket-rating-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              disabled={response.isPending}
            />
            <p className="text-xs text-muted-foreground">
              1–2 sao cần lý do ít nhất 5 ký tự. Đánh giá không thể sửa sau khi
              gửi.
            </p>
            <Button type="submit" disabled={response.isPending}>
              Gửi đánh giá
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            {ticket.status === "RESOLVED"
              ? "Đang chờ người gửi xác nhận."
              : "Chưa có đánh giá."}
          </p>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="text-sm text-primary">
            {success}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
