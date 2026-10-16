"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/axios";
import { useBulkAssignTickets, useTicketWorkload } from "../hooks";
import type { Ticket } from "../types";

type TicketWorkQueueProps = {
  filter: string;
  onFilterChange: (filter: string) => void;
  selectedTickets: Ticket[];
  onAssigned: () => void;
};

export function TicketWorkQueue({
  filter,
  onFilterChange,
  selectedTickets,
  onAssigned,
}: TicketWorkQueueProps) {
  const workload = useTicketWorkload();
  const bulkAssign = useBulkAssignTickets();
  const [assigneeId, setAssigneeId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const users = workload.data?.items ?? [];
  const assignee = users.find((user) => String(user.id) === assigneeId);
  const canAssign = Boolean(
    assignee?.isActive && !assignee.isLocked && selectedTickets.length,
  );

  async function handleAssign() {
    if (!canAssign || bulkAssign.isPending) return;
    setError("");
    setMessage("");
    try {
      const result = await bulkAssign.mutateAsync({
        ticketIds: selectedTickets.map((ticket) => ticket.id),
        assignedToId: Number(assigneeId),
      });
      setMessage(
        `Đã giao ${result.assignedCount} ticket cho ${assignee?.name}. ${result.unchangedCount} ticket đã có người xử lý này.`,
      );
      setConfirmOpen(false);
      onAssigned();
    } catch (error) {
      setError(
        getApiErrorMessage(error, "Không thể giao ticket. Vui lòng thử lại."),
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hàng đợi công việc IT</CardTitle>
        <CardDescription>
          Tải công việc chỉ tính ticket Mở và Đang xử lý.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Hàng đợi ticket"
        >
          {[
            { value: "ALL", label: "Tất cả" },
            { value: "MINE", label: "Việc của tôi" },
            {
              value: "UNASSIGNED",
              label: `Chưa được giao${workload.data ? ` (${workload.data.unassignedTickets})` : ""}`,
            },
          ].map((queue) => (
            <Button
              key={queue.value}
              variant={filter === queue.value ? "default" : "outline"}
              aria-pressed={filter === queue.value}
              onClick={() => onFilterChange(queue.value)}
            >
              {queue.label}
            </Button>
          ))}
          <Select
            value={/^\d+$/.test(filter) ? filter : "ALL"}
            onValueChange={onFilterChange}
          >
            <SelectTrigger
              className="w-full sm:w-72"
              aria-label="Lọc theo người xử lý"
            >
              <SelectValue placeholder="Người xử lý" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả người xử lý</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.name} · {user.totalTickets} ticket
                  {!user.isActive || user.isLocked ? " · Không khả dụng" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {workload.isLoading ? (
          <p className="text-sm text-muted-foreground">
            Đang tải khối lượng công việc...
          </p>
        ) : null}
        {workload.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 text-sm text-destructive"
          >
            <span>
              {getApiErrorMessage(
                workload.error,
                "Không thể tải khối lượng công việc.",
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => workload.refetch()}
            >
              Thử lại
            </Button>
          </div>
        ) : null}
        {workload.data ? (
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Khối lượng công việc từng người
            </summary>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border p-3 text-left hover:bg-muted focus-visible:outline-2"
                    onClick={() => onFilterChange(String(user.id))}
                  >
                    <span className="block font-medium">
                      {user.name}
                      {!user.isActive || user.isLocked
                        ? " (Không khả dụng)"
                        : ""}
                    </span>
                    <span className="block break-all text-xs text-muted-foreground">
                      {user.email}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      {user.openTickets} mở · {user.inProgressTickets} đang xử
                      lý
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {users.length === 0 ? (
              <p className="mt-2 text-muted-foreground">
                Chưa có nhân sự IT hoặc quản trị viên.
              </p>
            ) : null}
          </details>
        ) : null}

        {selectedTickets.length ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center">
            <p className="text-sm font-medium">
              Đã chọn {selectedTickets.length} ticket
            </p>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger
                className="w-full sm:w-72"
                aria-label="Người nhận ticket"
              >
                <SelectValue placeholder="Chọn người nhận" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((user) => user.isActive && !user.isLocked)
                  .map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name} · {user.totalTickets} ticket
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!canAssign || bulkAssign.isPending}
              onClick={() => {
                setError("");
                setConfirmOpen(true);
              }}
            >
              Giao ticket đã chọn
            </Button>
          </div>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-foreground">
            {message}
          </p>
        ) : null}

        <AlertDialog
          open={confirmOpen}
          onOpenChange={(open) => {
            if (!bulkAssign.isPending) setConfirmOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Xác nhận giao {selectedTickets.length} ticket
              </AlertDialogTitle>
              <AlertDialogDescription>
                Người nhận: {assignee?.name} ({assignee?.email}). Những ticket
                đã có người xử lý khác sẽ được giao lại.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="grid max-h-48 gap-2 overflow-y-auto text-sm">
              {selectedTickets.map((ticket) => (
                <li key={ticket.id}>
                  #{ticket.id} — {ticket.title}
                </li>
              ))}
            </ul>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkAssign.isPending}>
                Hủy
              </AlertDialogCancel>
              <Button
                disabled={!canAssign || bulkAssign.isPending}
                onClick={handleAssign}
              >
                {bulkAssign.isPending ? "Đang giao..." : "Xác nhận giao"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
