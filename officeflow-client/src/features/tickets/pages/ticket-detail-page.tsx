"use client";

import { AlertTriangle, MailCheck, ShieldAlert } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TicketAiAssistant } from "@/features/ai/components/ticket-ai-assistant";
import { TicketAssetPanel } from "@/features/assets/components/ticket-asset-panel";
import { useMe } from "@/features/auth/hooks";
import { useSuggestKnowledgeArticles } from "@/features/knowledge/hooks";
import { TicketResponseSla } from "@/features/sla/components/ticket-response-sla";
import { TicketAttachments } from "@/features/tickets/components/ticket-attachments";
import { TicketForm } from "@/features/tickets/components/ticket-form";
import { TicketResult } from "@/features/tickets/components/ticket-result";
import {
  getSlaMeta,
  getTicketDueAt,
  getTicketSlaState,
  ticketStatusOptions,
} from "@/features/tickets/constants";
import {
  useAddTicketComment,
  useAssignTicket,
  useDeleteTicket,
  useTicket,
  useTicketComments,
  useTicketHistory,
  useUpdateTicket,
  useUpdateTicketStatus,
} from "@/features/tickets/hooks";
import {
  toTicketPayload,
  type TicketFormValues,
} from "@/features/tickets/schemas";
import {
  canTransitionTicket,
  isTerminalTicket,
} from "@/features/tickets/status-policy";
import type { TicketStatus } from "@/features/tickets/types";
import { useTicketAssignees } from "@/features/users/hooks";
import { getApiErrorMessage } from "@/lib/axios";
import { TicketAssignmentPanel } from "../components/ticket-assignment-panel";
import {
  DetailSkeleton,
  ErrorCard,
} from "../components/ticket-detail-feedback";
import { TicketDetailHeader } from "../components/ticket-detail-header";
import { TicketDiscussion } from "../components/ticket-discussion";
import { TicketHistoryPanel } from "../components/ticket-history-panel";
import { TicketKnowledgeSuggestions } from "../components/ticket-knowledge-suggestions";
import { TicketProcessingSummary } from "../components/ticket-processing-summary";
import { TicketStatusPanel } from "../components/ticket-status-panel";
import {
  canEditTicket,
  canChangeStatus,
  canUseDiscussion,
  canDeleteTicket,
} from "../ticket-detail-policy";
import {
  formatDateTime,
  normalizeSearch,
  matchesStaffSearch,
} from "../ticket-detail.utils";

export function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTicketId = Number(params.id);
  const ticketId =
    Number.isInteger(rawTicketId) && rawTicketId > 0 ? rawTicketId : 0;
  const ticketQuery = useTicket(ticketId, ticketId > 0);
  const { data: user } = useMe();
  const allowDiscussion = canUseDiscussion(user, ticketQuery.data);
  const commentsQuery = useTicketComments(
    ticketId,
    ticketId > 0 && allowDiscussion,
  );
  const historyQuery = useTicketHistory(
    ticketId,
    ticketId > 0 && allowDiscussion,
  );
  const knowledgeSuggestionsQuery = useSuggestKnowledgeArticles(
    {
      title: ticketQuery.data?.title ?? "",
      description: ticketQuery.data?.description ?? "",
    },
    Boolean(ticketQuery.data?.title && ticketQuery.data.title.length >= 3),
  );
  const staffUsersQuery = useTicketAssignees(canChangeStatus(user));
  const updateTicket = useUpdateTicket();
  const updateStatus = useUpdateTicketStatus();
  const assignTicket = useAssignTicket();
  const deleteTicket = useDeleteTicket();
  const addComment = useAddTicketComment();
  const [isEditing, setIsEditing] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(() =>
    searchParams.get("created") === "success"
      ? "Đã tạo ticket. Email xác nhận sẽ được gửi nếu tính năng email đang bật."
      : null,
  );

  if (!ticketId) {
    return (
      <ErrorCard
        title="Ticket không hợp lệ"
        message="ID ticket trên URL không hợp lệ."
      />
    );
  }

  if (ticketQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <ErrorCard
        title="Không thể tải chi tiết ticket"
        message={getApiErrorMessage(
          ticketQuery.error,
          "Không thể tải chi tiết ticket.",
        )}
        onRetry={() => ticketQuery.refetch()}
      />
    );
  }

  const ticket = ticketQuery.data;
  const allowEdit = canEditTicket(user, ticket);
  const allowStatusChange =
    canChangeStatus(user) && !isTerminalTicket(ticket.status);
  const allowDelete = canDeleteTicket(user, ticket);
  const staffUsers = staffUsersQuery.data ?? [];
  const normalizedStaffSearch = normalizeSearch(staffSearch.trim());
  const visibleStaffUsers = staffUsers.filter((staff) =>
    matchesStaffSearch(staff, normalizedStaffSearch),
  );
  const selectedStaff = ticket.assignedTo?.id
    ? staffUsers.find((staff) => staff.id === ticket.assignedTo?.id)
    : undefined;
  const selectStaffUsers =
    selectedStaff &&
    !visibleStaffUsers.some((staff) => staff.id === selectedStaff.id)
      ? [selectedStaff, ...visibleStaffUsers]
      : visibleStaffUsers;
  const selectedStaffValue = selectedStaff ? String(selectedStaff.id) : "";
  const comments = commentsQuery.data ?? [];
  const historyItems =
    historyQuery.data?.filter((item) => item.action !== "COMMENTED") ?? [];
  const knowledgeSuggestions = knowledgeSuggestionsQuery.data ?? [];
  const dueAt = getTicketDueAt(ticket);
  const slaState = getTicketSlaState(ticket);
  const slaMeta = getSlaMeta(slaState);

  async function handleUpdate(values: TicketFormValues) {
    setFormError(null);

    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        input: toTicketPayload(values),
      });
      setIsEditing(false);
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          "Không thể cập nhật ticket. Vui lòng thử lại.",
        ),
      );
    }
  }

  async function handleStatusChange(value: string) {
    const status = value as TicketStatus;

    if (status === ticket.status) {
      return;
    }

    if (!canTransitionTicket(ticket.status, status) || updateStatus.isPending)
      return;
    if (
      status === "IN_PROGRESS" &&
      ticket.assignedTo &&
      staffUsersQuery.isSuccess &&
      !selectedStaff
    ) {
      setStatusError(
        "Người phụ trách không còn đủ điều kiện. Hãy giao lại ticket trước khi bắt đầu hoặc mở lại.",
      );
      return;
    }

    setStatusError(null);
    setActionFeedback(null);

    try {
      await updateStatus.mutateAsync({
        id: ticket.id,
        input: { status },
      });
      const statusLabel =
        ticketStatusOptions.find((item) => item.value === status)?.label ??
        status;

      setActionFeedback(
        status === "RESOLVED"
          ? `Đã chuyển ticket sang ${statusLabel}. Email kết quả sẽ được gửi cho người tạo nếu tính năng email đang bật.`
          : `Đã chuyển ticket sang ${statusLabel}.`,
      );
    } catch (error) {
      setStatusError(
        getApiErrorMessage(
          error,
          "Không thể cập nhật trạng thái. Vui lòng thử lại.",
        ),
      );
    }
  }

  async function handleAssign(assignedToId: number) {
    setAssignError(null);
    setActionFeedback(null);

    if (!Number.isInteger(assignedToId) || assignedToId <= 0) {
      setAssignError("ID người xử lý không hợp lệ.");
      return;
    }

    try {
      const assignee = staffUsers.find((staff) => staff.id === assignedToId);
      const actionLabel = ticket.assignedTo ? "chuyển người xử lý" : "gán";

      await assignTicket.mutateAsync({
        id: ticket.id,
        input: { assignedToId },
      });
      setActionFeedback(
        `Đã ${actionLabel} cho ${assignee?.name ?? "nhân viên đã chọn"}. Email thông báo sẽ được gửi nếu tính năng email đang bật.`,
      );
    } catch (error) {
      setAssignError(
        getApiErrorMessage(error, "Không thể gán ticket. Vui lòng thử lại."),
      );
    }
  }

  async function handleDelete() {
    setDeleteError(null);

    try {
      await deleteTicket.mutateAsync(ticket.id);
      router.replace("/tickets");
    } catch (error) {
      setDeleteError(
        getApiErrorMessage(error, "Không thể xóa ticket. Vui lòng thử lại."),
      );
    }
  }

  async function handleAddComment() {
    const content = commentContent.trim();

    setCommentError(null);

    if (content.length < 10) {
      setCommentError("Bình luận cần ít nhất 10 ký tự.");
      return;
    }

    if (content.length > 15_000) {
      setCommentError("Bình luận tối đa 15.000 ký tự.");
      return;
    }

    try {
      await addComment.mutateAsync({
        id: ticket.id,
        input: { content },
      });
      setCommentContent("");
    } catch (error) {
      setCommentError(
        getApiErrorMessage(error, "Không thể gửi bình luận. Vui lòng thử lại."),
      );
    }
  }

  return (
    <div className="grid gap-6 motion-enter">
      <TicketDetailHeader
        ticket={ticket}
        allowEdit={allowEdit}
        allowDelete={allowDelete}
        isEditing={isEditing}
        isDeleting={deleteTicket.isPending}
        onToggleEditing={() => setIsEditing((value) => !value)}
        onToggleDelete={() => setIsDeleteConfirmOpen((value) => !value)}
      />

      {deleteError ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
          {deleteError}
        </div>
      ) : null}

      {actionFeedback ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200 motion-toast"
        >
          <MailCheck className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-200" />
          <p className="font-medium leading-5">{actionFeedback}</p>
        </div>
      ) : null}

      {searchParams.get("assetLink") === "failed" ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-200 motion-toast">
          Ticket đã được tạo nhưng chưa thể liên kết tài sản. Bạn có thể thử lại
          tại mục Tài sản liên quan bên dưới.
        </div>
      ) : null}

      {isDeleteConfirmOpen ? (
        <Card className="border-destructive/25 bg-destructive/5 motion-panel">
          <CardContent className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <CardTitle>Xác nhận xóa ticket</CardTitle>
                <CardDescription className="mt-1">
                  Hành động này không thể hoàn tác.
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={deleteTicket.isPending}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteTicket.isPending}
              >
                Xác nhận xóa
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {slaState === "OVERDUE" || slaState === "DUE_SOON" ? (
        <Card
          className={
            slaState === "OVERDUE"
              ? "border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-400/10 text-red-950 dark:text-red-200 shadow-sm motion-panel"
              : "border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 text-amber-950 dark:text-amber-200 shadow-sm motion-panel"
          }
        >
          <CardContent className="flex items-start gap-3 pt-0">
            <div
              className={
                slaState === "OVERDUE"
                  ? "grid size-10 shrink-0 place-items-center rounded-lg bg-red-100 dark:bg-red-400/10 text-red-700 dark:text-red-200"
                  : "grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 dark:bg-amber-400/10 text-amber-700 dark:text-amber-200"
              }
            >
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <CardTitle>
                {slaState === "OVERDUE"
                  ? "Ticket đã quá hạn SLA"
                  : "Ticket sắp quá hạn SLA"}
              </CardTitle>
              <CardDescription
                className={
                  slaState === "OVERDUE"
                    ? "mt-1 text-red-800 dark:text-red-200"
                    : "mt-1 text-amber-800 dark:text-amber-200"
                }
              >
                {slaMeta.description} Hạn xử lý: {formatDateTime(dueAt)}.
              </CardDescription>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <TicketResponseSla ticket={ticket} />
          {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") &&
          user ? (
            <TicketResult
              key={ticket.id}
              ticket={ticket}
              isRequester={user.id === ticket.createdBy?.id}
            />
          ) : null}
          <Card className="shadow-sm motion-panel">
            <CardHeader className="border-b">
              <CardTitle>Mô tả yêu cầu</CardTitle>
              <CardDescription>
                Nội dung chi tiết do người tạo ticket cung cấp.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          {canChangeStatus(user) ? (
            <TicketAiAssistant
              key={`ai-${ticket.id}`}
              ticketId={ticket.id}
              status={ticket.status}
              commentPending={addComment.isPending}
              onUseReply={(content) => {
                const combined = commentContent
                  ? `${commentContent}\n\n${content}`
                  : content;
                if (combined.trim().length > 15000)
                  return "Bình luận sau khi thêm vượt quá 15.000 ký tự. Hãy rút gọn nội dung.";
                setCommentContent(combined);
                document.getElementById("ticket-comment-content")?.focus();
                return null;
              }}
            />
          ) : null}

          {allowDiscussion ? (
            <TicketAttachments
              ticketId={ticket.id}
              currentUser={user}
              enabled={allowDiscussion}
            />
          ) : null}

          {allowDiscussion ? (
            <TicketAssetPanel ticket={ticket} currentUser={user} />
          ) : null}

          {allowDiscussion ? (
            <TicketDiscussion
              comments={comments}
              content={commentContent}
              onContentChange={setCommentContent}
              onSubmit={handleAddComment}
              isSubmitting={addComment.isPending}
              error={commentError}
              isLoading={commentsQuery.isLoading}
              isError={commentsQuery.isError}
              onRetry={() => commentsQuery.refetch()}
            />
          ) : null}

          {isEditing && allowEdit ? (
            <Card className="shadow-sm motion-panel">
              <CardHeader className="border-b">
                <CardTitle>Cập nhật ticket</CardTitle>
                <CardDescription>
                  Chỉnh các thông tin cần thiết rồi lưu thay đổi.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <TicketForm
                  key={ticket.id}
                  defaultValues={{
                    title: ticket.title,
                    description: ticket.description,
                    priority: ticket.priority,
                    categoryId: ticket.category?.id
                      ? String(ticket.category.id)
                      : "",
                  }}
                  submitLabel="Lưu thay đổi"
                  isSubmitting={updateTicket.isPending}
                  error={formError}
                  onCancel={() => setIsEditing(false)}
                  onSubmit={handleUpdate}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="grid gap-4 self-start">
          <TicketProcessingSummary ticket={ticket} />

          {allowStatusChange ? (
            <TicketStatusPanel
              ticket={ticket}
              isPending={updateStatus.isPending}
              error={statusError}
              assigneesReady={staffUsersQuery.isSuccess}
              hasEligibleAssignee={Boolean(selectedStaff)}
              onStatusChange={handleStatusChange}
            />
          ) : null}

          {allowStatusChange ? (
            <TicketAssignmentPanel
              staffUsers={staffUsers}
              options={selectStaffUsers}
              value={selectedStaffValue}
              search={staffSearch}
              onSearchChange={setStaffSearch}
              onAssign={handleAssign}
              isPending={assignTicket.isPending}
              error={assignError}
              isLoading={staffUsersQuery.isLoading}
              isError={staffUsersQuery.isError}
              loadError={staffUsersQuery.error}
              onRetry={() => staffUsersQuery.refetch()}
            />
          ) : null}

          <TicketKnowledgeSuggestions
            articles={knowledgeSuggestions}
            isLoading={knowledgeSuggestionsQuery.isLoading}
            isError={knowledgeSuggestionsQuery.isError}
            onRetry={() => knowledgeSuggestionsQuery.refetch()}
          />

          {allowDiscussion ? (
            <TicketHistoryPanel
              items={historyItems}
              isLoading={historyQuery.isLoading}
              isError={historyQuery.isError}
              onRetry={() => historyQuery.refetch()}
            />
          ) : null}

          <Card className="bg-teal-950 text-white shadow-sm">
            <CardContent className="pt-0">
              <p className="text-sm font-semibold">Phân quyền hiện tại</p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                EMPLOYEE chỉ xem và chỉnh ticket của mình khi còn mở. ADMIN và
                IT_STAFF có thể xử lý trạng thái và gán ticket.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
