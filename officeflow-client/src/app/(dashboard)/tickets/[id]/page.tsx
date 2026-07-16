"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Trash2,
  UserCircle,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
import { useMe } from "@/features/auth/hooks";
import type { AuthUser } from "@/features/auth/types";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/features/tickets/components/ticket-badges";
import { TicketForm } from "@/features/tickets/components/ticket-form";
import { ticketStatusOptions } from "@/features/tickets/constants";
import {
  useAssignTicket,
  useDeleteTicket,
  useTicket,
  useUpdateTicket,
  useUpdateTicketStatus,
} from "@/features/tickets/hooks";
import {
  toTicketPayload,
  type TicketFormValues,
} from "@/features/tickets/schemas";
import type { Ticket, TicketStatus } from "@/features/tickets/types";
import { useUsers } from "@/features/users/hooks";
import { getApiErrorMessage } from "@/lib/axios";

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function canEditTicket(user: AuthUser | undefined, ticket: Ticket) {
  if (!user) {
    return false;
  }

  if (user.role === "EMPLOYEE") {
    return ticket.createdBy?.id === user.id && ticket.status === "OPEN";
  }

  return true;
}

function canChangeStatus(user: AuthUser | undefined) {
  return user?.role === "ADMIN" || user?.role === "IT_STAFF";
}

function canDeleteTicket(user: AuthUser | undefined, ticket: Ticket) {
  if (!user) {
    return false;
  }

  return (
    user.role === "ADMIN" ||
    (user.role === "EMPLOYEE" &&
      ticket.createdBy?.id === user.id &&
      ticket.status === "OPEN")
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-8 w-48 rounded-full bg-muted motion-shimmer" />
      <Card>
        <CardContent className="grid gap-4 pt-0">
          <div className="h-8 w-2/3 rounded-full bg-muted motion-shimmer" />
          <div className="h-28 rounded-lg bg-muted motion-shimmer" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-20 rounded-lg bg-muted motion-shimmer" />
            <div className="h-20 rounded-lg bg-muted motion-shimmer" />
            <div className="h-20 rounded-lg bg-muted motion-shimmer" />
          </div>
        </CardContent>
      </Card>
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
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
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

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawTicketId = Number(params.id);
  const ticketId =
    Number.isInteger(rawTicketId) && rawTicketId > 0 ? rawTicketId : 0;
  const ticketQuery = useTicket(ticketId, ticketId > 0);
  const { data: user } = useMe();
  const usersQuery = useUsers(user?.role === "ADMIN");
  const updateTicket = useUpdateTicket();
  const updateStatus = useUpdateTicketStatus();
  const assignTicket = useAssignTicket();
  const deleteTicket = useDeleteTicket();
  const [isEditing, setIsEditing] = useState(false);
  const [manualAssigneeId, setManualAssigneeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  const allowStatusChange = canChangeStatus(user);
  const allowDelete = canDeleteTicket(user, ticket);
  const staffUsers =
    usersQuery.data?.filter(
      (item) => item.role === "ADMIN" || item.role === "IT_STAFF",
    ) ?? [];

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
        getApiErrorMessage(error, "Không thể cập nhật ticket. Vui lòng thử lại."),
      );
    }
  }

  async function handleStatusChange(value: string) {
    const status = value as TicketStatus;

    if (status === ticket.status) {
      return;
    }

    setStatusError(null);

    try {
      await updateStatus.mutateAsync({
        id: ticket.id,
        input: { status },
      });
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

    if (!Number.isInteger(assignedToId) || assignedToId <= 0) {
      setAssignError("ID người xử lý không hợp lệ.");
      return;
    }

    try {
      await assignTicket.mutateAsync({
        id: ticket.id,
        input: { assignedToId },
      });
      setManualAssigneeId("");
    } catch (error) {
      setAssignError(
        getApiErrorMessage(error, "Không thể assign ticket. Vui lòng thử lại."),
      );
    }
  }

  async function handleDelete() {
    setDeleteError(null);

    if (!window.confirm("Xóa ticket này? Hành động này không thể hoàn tác.")) {
      return;
    }

    try {
      await deleteTicket.mutateAsync(ticket.id);
      router.replace("/tickets");
    } catch (error) {
      setDeleteError(
        getApiErrorMessage(error, "Không thể xóa ticket. Vui lòng thử lại."),
      );
    }
  }

  const metaItems = [
    {
      label: "Người tạo",
      value: ticket.createdBy?.name ?? "-",
      icon: UserCircle,
    },
    {
      label: "Người xử lý",
      value: ticket.assignedTo?.name ?? "Chưa gán",
      icon: CheckCircle2,
    },
    {
      label: "Ngày tạo",
      value: formatDateTime(ticket.createdAt),
      icon: CalendarClock,
    },
  ];

  return (
    <div className="grid gap-6 motion-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2 mb-2">
            <Link href="/tickets">
              <ArrowLeft className="size-4" />
              Quay lại
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="mt-3 max-w-4xl text-2xl font-semibold tracking-normal sm:text-3xl">
            #{ticket.id} {ticket.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cập nhật lần cuối: {formatDateTime(ticket.updatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {allowEdit ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing((value) => !value)}
            >
              <Edit3 className="size-4" />
              {isEditing ? "Đóng form" : "Sửa ticket"}
            </Button>
          ) : null}
          {allowDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTicket.isPending}
            >
              <Trash2 className="size-4" />
              {deleteTicket.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          ) : null}
        </div>
      </div>

      {deleteError ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
          {deleteError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
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
          <Card className="shadow-sm">
            <CardHeader className="border-b">
              <CardTitle>Thông tin xử lý</CardTitle>
              <CardDescription>
                Trạng thái, người xử lý và timeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0">
              {metaItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex gap-3 rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-950/5 text-teal-950">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold">
                        {item.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {allowStatusChange ? (
            <Card className="shadow-sm motion-panel">
              <CardHeader className="border-b">
                <CardTitle>Cập nhật trạng thái</CardTitle>
                <CardDescription>
                  Chỉ ADMIN và IT_STAFF có quyền đổi trạng thái.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0">
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketStatusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusError ? (
                  <p className="text-sm font-medium text-destructive">
                    {statusError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {allowStatusChange ? (
            <Card className="shadow-sm motion-panel">
              <CardHeader className="border-b">
                <CardTitle>Assign ticket</CardTitle>
                <CardDescription>
                  Gán ticket cho ADMIN hoặc IT_STAFF theo API hiện có.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0">
                {user?.role === "ADMIN" ? (
                  <Select
                    value={ticket.assignedTo?.id ? String(ticket.assignedTo.id) : ""}
                    onValueChange={(value) => handleAssign(Number(value))}
                    disabled={assignTicket.isPending || usersQuery.isLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn người xử lý" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffUsers.map((staff) => (
                        <SelectItem key={staff.id} value={String(staff.id)}>
                          {staff.name} / {staff.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={manualAssigneeId}
                      onChange={(event) =>
                        setManualAssigneeId(event.target.value)
                      }
                      placeholder="Nhập assignedToId"
                      disabled={assignTicket.isPending}
                    />
                    <Button
                      type="button"
                      onClick={() => handleAssign(Number(manualAssigneeId))}
                      disabled={assignTicket.isPending}
                    >
                      <UserPlus className="size-4" />
                      Gán
                    </Button>
                  </div>
                )}
                {assignError ? (
                  <p className="text-sm font-medium text-destructive">
                    {assignError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="bg-teal-950 text-white shadow-sm">
            <CardContent className="pt-0">
              <p className="text-sm font-semibold">Phân quyền hiện tại</p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                EMPLOYEE chỉ xem ticket của mình. ADMIN và IT_STAFF có thể xử
                lý trạng thái và assign ticket.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
