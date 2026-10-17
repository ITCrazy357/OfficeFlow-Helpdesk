"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthUser } from "@/features/auth/types";
import { getUsersApi } from "@/features/users/api";
import {
  getLeaveRequestErrorMessage,
  getTodayDateInputValue,
} from "../constants";
import { useLeaveBalance, useSetLeaveEntitlement } from "../planning";
import type { LeaveBalance } from "../types";

function EntitlementForm({ balance }: { balance: LeaveBalance }) {
  const save = useSetLeaveEntitlement();
  const [days, setDays] = useState(balance.allowance?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    const allowance = Number(days);
    if (
      !days.trim() ||
      !Number.isFinite(allowance) ||
      allowance < 0 ||
      allowance > 366 ||
      !Number.isInteger(allowance * 2)
    ) {
      setError("Nhập số ngày từ 0 đến 366, theo bước 0,5 ngày.");
      return;
    }
    try {
      await save.mutateAsync({
        userId: balance.userId,
        year: balance.year,
        days: allowance,
        version: balance.version,
      });
      setSaved(true);
    } catch (failure) {
      setError(getLeaveRequestErrorMessage(failure, "Không thể lưu hạn mức."));
    }
  }
  return (
    <form
      aria-label="Cấu hình hạn mức phép"
      className="grid gap-3 rounded-lg border p-4"
      onSubmit={submit}
    >
      <Label htmlFor="leave-allowance">
        Hạn mức phép năm {balance.year} (ngày)
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="leave-allowance"
          className="w-36"
          type="number"
          step="0.5"
          min="0"
          max="366"
          value={days}
          onChange={(event) => setDays(event.target.value)}
          disabled={save.isPending}
        />
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Đang lưu..." : "Lưu hạn mức"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Nhập hạn mức cho riêng năm này. Không tự chuyển dư; không thể giảm xuống
        dưới số đã dùng và đang chờ duyệt.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-primary">
          Đã lưu hạn mức.
        </p>
      ) : null}
    </form>
  );
}

export function LeaveBalancePanel({ user }: { user: AuthUser }) {
  const [year, setYear] = useState(
    Number(getTodayDateInputValue().slice(0, 4)),
  );
  const [userId, setUserId] = useState(user.id);
  const isAdmin = user.role === "ADMIN";
  const users = useQuery({
    queryKey: ["users"],
    queryFn: getUsersApi,
    enabled: isAdmin,
  });
  const balance = useLeaveBalance(year, isAdmin ? userId : undefined);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Số dư phép năm</CardTitle>
        <CardDescription>
          Phân biệt số đã duyệt, đang giữ chỗ và số còn có thể đăng ký.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="leave-balance-year">Năm</Label>
            <Input
              className="w-28"
              id="leave-balance-year"
              type="number"
              min="2000"
              max="9998"
              value={year || ""}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
          {isAdmin ? (
            <div className="grid min-w-0 flex-1 gap-2">
              <Label htmlFor="leave-balance-user">Nhân viên</Label>
              <select
                id="leave-balance-user"
                className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
                value={userId}
                onChange={(event) => setUserId(Number(event.target.value))}
              >
                <option value={user.id}>Tôi — {user.name}</option>
                {(users.data ?? [])
                  .filter((item) => item.id !== user.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.email}
                    </option>
                  ))}
              </select>
              {users.isError ? (
                <p role="alert" className="text-xs text-destructive">
                  Không tải được danh sách nhân viên.{" "}
                  <button className="underline" onClick={() => users.refetch()}>
                    Thử lại
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {balance.isError ? (
          <div role="alert" className="grid gap-2 text-sm text-destructive">
            Không thể tải số dư phép.
            <Button variant="outline" onClick={() => balance.refetch()}>
              Tải lại số dư
            </Button>
          </div>
        ) : balance.isPending ? (
          <p className="text-sm text-muted-foreground">
            Chọn năm hợp lệ để xem số dư.
          </p>
        ) : balance.data ? (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Hạn mức", balance.data.allowance],
                ["Đã duyệt", balance.data.used],
                ["Chờ duyệt", balance.data.reserved],
                ["Khả dụng", balance.data.remaining],
              ].map(([label, value]) => (
                <div
                  className="rounded-lg border bg-muted/20 p-3"
                  key={String(label)}
                >
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-2 text-lg font-semibold">
                    {value === null ? "Chưa cấu hình" : `${value} ngày`}
                  </dd>
                </div>
              ))}
            </dl>
            {balance.data.legacyRequests > 0 ? (
              <p className="text-sm text-muted-foreground">
                Có {balance.data.legacyRequests} đơn cũ chưa phân loại, chưa
                được trừ vào số dư này. ADMIN cần đối chiếu khi nhập hạn mức.
              </p>
            ) : null}
            {isAdmin ? (
              <EntitlementForm
                key={`${userId}-${year}`}
                balance={balance.data}
              />
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
