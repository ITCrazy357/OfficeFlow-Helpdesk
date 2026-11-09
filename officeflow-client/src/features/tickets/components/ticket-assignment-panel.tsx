"use client";

import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/axios";
import { getStaffSupportingText } from "../ticket-detail.utils";
import type { UserListItem } from "@/features/users/types";

type TicketAssignmentPanelProps = {
  staffUsers: UserListItem[];
  options: UserListItem[];
  value: string;
  search: string;
  onSearchChange: (value: string) => void;
  onAssign: (id: number) => void;
  isPending: boolean;
  error: string | null;
  isLoading: boolean;
  isError: boolean;
  loadError: unknown;
  onRetry: () => void;
};

export function TicketAssignmentPanel({
  staffUsers,
  options,
  value,
  search,
  onSearchChange,
  onAssign,
  isPending,
  error,
  isLoading,
  isError,
  loadError,
  onRetry,
}: TicketAssignmentPanelProps) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <CardTitle>Gán người xử lý</CardTitle>
        <CardDescription>
          Chỉ ADMIN hoặc IT_STAFF mới có quyền gán ticket.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0">
        {isLoading ? (
          <div className="grid gap-2">
            <div className="h-10 rounded-lg bg-muted motion-shimmer" />
            <div className="h-10 rounded-lg bg-muted motion-shimmer" />
          </div>
        ) : null}
        {isError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">
              Không thể tải danh sách nhân viên IT.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {getApiErrorMessage(loadError, "Vui lòng thử lại sau.")}
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
        ) : null}
        <Input
          type="search"
          aria-label="Tìm theo tên, email hoặc phòng ban"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Tìm theo tên, email hoặc phòng ban"
          disabled={
            isPending || isLoading || isError || staffUsers.length === 0
          }
        />
        <Select
          value={value}
          onValueChange={(value) => onAssign(Number(value))}
          disabled={
            isPending || isLoading || isError || staffUsers.length === 0
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Chọn nhân viên IT" />
          </SelectTrigger>
          <SelectContent>
            {options.map((staff) => (
              <SelectItem key={staff.id} value={String(staff.id)}>
                <div className="grid gap-0.5">
                  <span className="font-medium">{staff.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {getStaffSupportingText(staff) ||
                      "Chưa có email hoặc phòng ban"}
                  </span>
                </div>
              </SelectItem>
            ))}
            {options.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Không tìm thấy nhân viên IT phù hợp.
              </div>
            ) : null}
          </SelectContent>
        </Select>
        {isPending ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Đang gán người xử lý...
          </p>
        ) : null}
        <div className="flex items-start gap-2 rounded-lg border border-sky-200/80 dark:border-sky-400/25 bg-sky-50/70 dark:bg-sky-400/10 p-3 text-xs leading-5 text-sky-900 dark:text-sky-200">
          <MailCheck className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Khi gán hoặc chuyển người xử lý, hệ thống gửi email cho người được
            chọn nếu tính năng email đang bật.
          </p>
        </div>
        {staffUsers.length === 0 && !isLoading && !isError ? (
          <p className="text-xs text-muted-foreground">
            Chưa có nhân viên IT đang hoạt động trong danh sách users.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm font-medium text-destructive">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
