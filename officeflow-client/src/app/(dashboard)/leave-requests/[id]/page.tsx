"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Send,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useMe } from "@/features/auth/hooks";
import { LeaveRequestStatusBadge } from "@/features/leave-requests/components/leave-request-status-badge";
import {
  formatLeaveDate,
  formatLeaveDateTime,
  getLeaveDayCount,
  getLeaveRequestErrorMessage,
  leaveRequestStatusLabels,
} from "@/features/leave-requests/constants";
import {
  useApproveLeaveRequest,
  useCancelLeaveRequest,
  useLeaveRequest,
  useRejectLeaveRequest,
} from "@/features/leave-requests/hooks";

function DetailSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-8 w-48 rounded-full bg-muted motion-shimmer" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="grid gap-4 pt-0">
            <div className="h-8 w-2/3 rounded-full bg-muted motion-shimmer" />
            <div className="h-32 rounded-lg bg-muted motion-shimmer" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-20 rounded-lg bg-muted motion-shimmer" />
              <div className="h-20 rounded-lg bg-muted motion-shimmer" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-3 pt-0">
            <div className="h-16 rounded-lg bg-muted motion-shimmer" />
            <div className="h-16 rounded-lg bg-muted motion-shimmer" />
            <div className="h-16 rounded-lg bg-muted motion-shimmer" />
          </CardContent>
        </Card>
      </div>
    </div>
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

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function LeaveRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data: user } = useMe();
  const rawLeaveRequestId = Number(params.id);
  const leaveRequestId =
    Number.isInteger(rawLeaveRequestId) && rawLeaveRequestId > 0
      ? rawLeaveRequestId
      : 0;
  const leaveRequestQuery = useLeaveRequest(
    leaveRequestId,
    leaveRequestId > 0,
  );
  const approveLeaveRequest = useApproveLeaveRequest();
  const rejectLeaveRequest = useRejectLeaveRequest();
  const cancelLeaveRequest = useCancelLeaveRequest();
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewNoteError, setReviewNoteError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(() =>
    searchParams.get("created") === "success"
      ? "Đã tạo đơn nghỉ phép. Email thông báo có thể được gửi nếu tính năng email đang bật."
      : null,
  );

  if (!leaveRequestId) {
    return (
      <ErrorCard
        title="Đơn nghỉ phép không hợp lệ"
        message="ID đơn trên URL không hợp lệ."
      />
    );
  }

  if (leaveRequestQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (leaveRequestQuery.isError || !leaveRequestQuery.data) {
    return (
      <ErrorCard
        title="Không thể tải chi tiết đơn"
        message={getLeaveRequestErrorMessage(
          leaveRequestQuery.error,
          "Không thể tải chi tiết đơn nghỉ phép.",
        )}
        onRetry={() => leaveRequestQuery.refetch()}
      />
    );
  }

  const leaveRequest = leaveRequestQuery.data;
  const isRequester = leaveRequest.requester.id === user?.id;
  const isAssignedApprover = leaveRequest.approver.id === user?.id;
  const hasReviewerRole = user?.role === "MANAGER" || user?.role === "ADMIN";
  const canReview =
    leaveRequest.status === "PENDING" &&
    hasReviewerRole &&
    isAssignedApprover &&
    !isRequester;
  const canCancel = leaveRequest.status === "PENDING" && isRequester;
  const isActionPending =
    approveLeaveRequest.isPending ||
    rejectLeaveRequest.isPending ||
    cancelLeaveRequest.isPending;
  const dayCount = getLeaveDayCount(
    leaveRequest.startDate,
    leaveRequest.endDate,
  );

  async function handleApprove() {
    setActionError(null);

    try {
      await approveLeaveRequest.mutateAsync(leaveRequest.id);
      setIsApproveDialogOpen(false);
      setActionFeedback("Đã duyệt đơn nghỉ phép.");
    } catch (error) {
      setActionError(
        getLeaveRequestErrorMessage(error, "Không thể duyệt đơn nghỉ phép."),
      );
    }
  }

  async function handleReject() {
    const normalizedReviewNote = reviewNote.trim();

    if (normalizedReviewNote.length < 3) {
      setReviewNoteError("Lý do từ chối cần ít nhất 3 ký tự.");
      return;
    }

    setActionError(null);
    setReviewNoteError(null);

    try {
      await rejectLeaveRequest.mutateAsync({
        id: leaveRequest.id,
        input: { reviewNote: normalizedReviewNote },
      });
      setIsRejectDialogOpen(false);
      setReviewNote("");
      setActionFeedback("Đã từ chối đơn và ghi nhận lý do.");
    } catch (error) {
      setActionError(
        getLeaveRequestErrorMessage(error, "Không thể từ chối đơn nghỉ phép."),
      );
    }
  }

  async function handleCancel() {
    setActionError(null);

    try {
      await cancelLeaveRequest.mutateAsync(leaveRequest.id);
      setIsCancelDialogOpen(false);
      setActionFeedback("Đã hủy đơn nghỉ phép.");
    } catch (error) {
      setActionError(
        getLeaveRequestErrorMessage(error, "Không thể hủy đơn nghỉ phép."),
      );
    }
  }

  return (
    <div className="grid gap-6 motion-enter">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2 mb-2">
            <Link href="/leave-requests">
              <ArrowLeft className="size-4" />
              Quay lại
            </Link>
          </Button>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <CalendarDays className="size-3.5" />
              Đơn #{leaveRequest.id}
            </span>
            <LeaveRequestStatusBadge status={leaveRequest.status} />
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            {formatLeaveDate(leaveRequest.startDate)} - {formatLeaveDate(leaveRequest.endDate)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dayCount} ngày theo lịch, gửi lúc {formatLeaveDateTime(leaveRequest.createdAt)}.
          </p>
        </div>
      </section>

      {actionFeedback ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 motion-toast dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span className="font-medium">{actionFeedback}</span>
          <button
            type="button"
            className="ml-auto text-xs font-semibold underline underline-offset-4"
            onClick={() => setActionFeedback(null)}
          >
            Đóng
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive motion-toast"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="font-medium">{actionError}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          <Card className="shadow-sm motion-panel">
            <CardHeader className="border-b">
              <CardTitle>Thông tin nghỉ phép</CardTitle>
              <CardDescription>
                Khoảng thời gian và nội dung gửi tới người duyệt.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 pt-0">
              <div className="grid gap-3 sm:grid-cols-3">
                <DetailItem
                  label="Ngày bắt đầu"
                  value={formatLeaveDate(leaveRequest.startDate)}
                />
                <DetailItem
                  label="Ngày kết thúc"
                  value={formatLeaveDate(leaveRequest.endDate)}
                />
                <DetailItem
                  label="Thời lượng"
                  value={`${dayCount} ngày theo lịch`}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <LockKeyhole className="size-4 text-teal-800 dark:text-teal-300" />
                  <h2 className="font-semibold">Lý do nghỉ</h2>
                </div>
                <p className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-sm leading-7 text-foreground">
                  {leaveRequest.reason}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Nội dung này chỉ được trả về cho người gửi và người duyệt được chỉ định.
                </p>
              </div>
            </CardContent>
          </Card>

          {leaveRequest.reviewNote ? (
            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle>Phản hồi của người duyệt</CardTitle>
                <CardDescription>
                  Lý do được ghi nhận khi đơn bị từ chối.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
                  {leaveRequest.reviewNote}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="grid gap-4 self-start">
          <Card className="shadow-sm">
            <CardHeader className="border-b">
              <CardTitle>Luồng phê duyệt</CardTitle>
              <CardDescription>
                Trạng thái hiện tại: {leaveRequestStatusLabels[leaveRequest.status]}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-0">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                  <Send className="size-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Người gửi</p>
                  <p className="mt-0.5 font-semibold">
                    {leaveRequest.requester.name}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                  <UserRoundCheck className="size-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Người duyệt được chỉ định</p>
                  <p className="mt-0.5 font-semibold">
                    {leaveRequest.approver.name}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Clock3 className="size-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Xử lý lúc</p>
                  <p className="mt-0.5 font-semibold">
                    {formatLeaveDateTime(leaveRequest.reviewedAt)}
                  </p>
                  {leaveRequest.reviewedBy ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bởi {leaveRequest.reviewedBy.name}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {canReview || canCancel ? (
            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle>Thao tác</CardTitle>
                <CardDescription>
                  Chỉ đơn đang chờ duyệt mới có thể thay đổi trạng thái.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 pt-0">
                {canReview ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setIsApproveDialogOpen(true);
                      }}
                      disabled={isActionPending}
                    >
                      <ShieldCheck className="size-4" />
                      Duyệt đơn
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        setActionError(null);
                        setReviewNoteError(null);
                        setIsRejectDialogOpen(true);
                      }}
                      disabled={isActionPending}
                    >
                      <XCircle className="size-4" />
                      Từ chối
                    </Button>
                  </>
                ) : null}

                {canCancel ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActionError(null);
                      setIsCancelDialogOpen(true);
                    }}
                    disabled={isActionPending}
                  >
                    <Ban className="size-4" />
                    Hủy đơn
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {user?.role === "ADMIN" && isAssignedApprover ? (
            <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-xs leading-5 text-muted-foreground shadow-sm">
              <LockKeyhole className="mt-0.5 size-4 shrink-0 text-teal-800 dark:text-teal-300" />
              <p>
                Bạn thấy lý do của đơn này vì được chỉ định là người duyệt, không phải do quyền Admin.
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <AlertDialog
        open={isApproveDialogOpen}
        onOpenChange={(open) => {
          if (!approveLeaveRequest.isPending) {
            setIsApproveDialogOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duyệt đơn nghỉ phép?</AlertDialogTitle>
            <AlertDialogDescription>
              Đơn #{leaveRequest.id} của {leaveRequest.requester.name} sẽ chuyển sang trạng thái đã duyệt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {actionError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                disabled={approveLeaveRequest.isPending}
              >
                Quay lại
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                disabled={approveLeaveRequest.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void handleApprove();
                }}
              >
                <CheckCircle2 className="size-4" />
                {approveLeaveRequest.isPending ? "Đang duyệt..." : "Xác nhận duyệt"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isRejectDialogOpen}
        onOpenChange={(open) => {
          if (!rejectLeaveRequest.isPending) {
            setIsRejectDialogOpen(open);
            if (!open) {
              setReviewNoteError(null);
            }
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Từ chối đơn nghỉ phép</AlertDialogTitle>
            <AlertDialogDescription>
              Ghi rõ lý do để người gửi hiểu quyết định và có thể điều chỉnh kế hoạch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="leave-review-note">Lý do từ chối</Label>
            <Textarea
              id="leave-review-note"
              value={reviewNote}
              onChange={(event) => {
                setReviewNote(event.target.value);
                if (reviewNoteError) {
                  setReviewNoteError(null);
                }
              }}
              className="min-h-28 resize-y"
              placeholder="Nhập lý do từ chối"
              maxLength={2000}
              aria-invalid={Boolean(reviewNoteError)}
              disabled={rejectLeaveRequest.isPending}
            />
            {reviewNoteError ? (
              <p className="text-xs font-medium text-destructive">
                {reviewNoteError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tối thiểu 3 ký tự, tối đa 2.000 ký tự.
              </p>
            )}
          </div>
          {actionError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {actionError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                disabled={rejectLeaveRequest.isPending}
              >
                Quay lại
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={rejectLeaveRequest.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void handleReject();
                }}
              >
                <XCircle className="size-4" />
                {rejectLeaveRequest.isPending ? "Đang từ chối..." : "Xác nhận từ chối"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isCancelDialogOpen}
        onOpenChange={(open) => {
          if (!cancelLeaveRequest.isPending) {
            setIsCancelDialogOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy đơn nghỉ phép?</AlertDialogTitle>
            <AlertDialogDescription>
              Đơn #{leaveRequest.id} sẽ chuyển sang trạng thái đã hủy và không thể gửi lại để duyệt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {actionError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                disabled={cancelLeaveRequest.isPending}
              >
                Giữ đơn
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={cancelLeaveRequest.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void handleCancel();
                }}
              >
                <Ban className="size-4" />
                {cancelLeaveRequest.isPending ? "Đang hủy..." : "Xác nhận hủy"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
