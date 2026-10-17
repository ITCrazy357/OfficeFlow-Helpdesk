import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { api, getApiErrorMessage } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";

export type TicketFeedback = {
  score: number;
  comment: string | null;
  createdAt: string;
};
type ResponseCommand =
  | { action: "confirm"; resolutionVersion: number }
  | { action: "reopen"; resolutionVersion: number; reason: string }
  | { action: "feedback"; score: number; comment?: string };

export function useTicketFeedback(id: number) {
  const cache = useQueryClient();
  const key = ["tickets", "feedback", id] as const;
  return useQuery({
    queryKey: key,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const response = await api.get<ApiResponse<TicketFeedback | null>>(
          `/tickets/${id}/feedback`,
          { signal },
        );
        return response.data.data;
      } catch (error) {
        if (
          isAxiosError(error) &&
          [401, 403, 404].includes(error.response?.status ?? 0)
        )
          cache.setQueryData(key, null);
        throw error;
      }
    },
  });
}

export function useRespondToTicket(id: number) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, ...data }: ResponseCommand) => {
      await api.post(`/tickets/${id}/${action}`, data);
    },
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ["tickets"] }),
        cache.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
  });
}

export function validateTicketRating(score: number, comment: string) {
  if (!Number.isInteger(score) || score < 1 || score > 5)
    return "Chọn mức đánh giá từ 1 đến 5 sao.";
  if (score <= 2 && comment.trim().length < 5)
    return "Đánh giá 1–2 sao cần lý do ít nhất 5 ký tự.";
  if (comment.trim().length > 2000) return "Nội dung tối đa 2.000 ký tự.";
  return null;
}

export function ticketFeedbackError(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error, fallback);
  const labels: Record<string, string> = {
    "Ticket result changed. Reload before responding":
      "Kết quả ticket đã thay đổi. Kiểm tra thông tin mới trước khi phản hồi lại.",
    "Only the requester can confirm the ticket result":
      "Chỉ người gửi được xác nhận kết quả ticket.",
    "Only the requester can rate the ticket":
      "Chỉ người gửi được đánh giá hỗ trợ.",
    "This ticket has already been rated":
      "Ticket này đã được đánh giá. Không thể gửi thêm hoặc sửa đánh giá.",
    "Confirm the ticket result before rating":
      "Hãy xác nhận kết quả ticket trước khi đánh giá.",
  };
  return labels[message] ?? message;
}
