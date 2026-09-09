"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getHandoffCandidates } from "../lifecycle";
import type { UserListItem } from "../types";

export function UserHandoffForm({
  user,
  users,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: {
  user: UserListItem;
  users: UserListItem[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (replacementId: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [replacementId, setReplacementId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const candidates = getHandoffCandidates(users, user.id);
  const replacement = candidates.find(
    (candidate) => String(candidate.id) === replacementId,
  );

  return (
    <form
      className="grid gap-4"
      aria-busy={isSubmitting}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!replacement || !confirmed || isSubmitting) return;
        await onSubmit(replacement.id);
      }}
    >
      <p className="text-sm leading-6 text-muted-foreground">
        Chuyển toàn bộ nhân viên trực thuộc (kể cả người đang inactive) và đơn
        nghỉ đang chờ duyệt của <strong>{user.name}</strong> sang người nhận.
        Không thay đổi đơn đã duyệt, quyền hay trạng thái tài khoản.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="handoff-replacement">Người nhận bàn giao</Label>
        <Select
          value={replacement ? replacementId : ""}
          onValueChange={(value) => {
            setReplacementId(value);
            setConfirmed(false);
          }}
          disabled={isSubmitting || candidates.length === 0}
        >
          <SelectTrigger id="handoff-replacement" className="w-full">
            <SelectValue placeholder="Chọn MANAGER hoặc ADMIN" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((candidate) => (
              <SelectItem key={candidate.id} value={String(candidate.id)}>
                {candidate.name} — {candidate.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {candidates.length === 0 ? (
          <p role="status" className="text-sm text-destructive">
            Không có người nhận hợp lệ khác. Cần MANAGER hoặc ADMIN đang hoạt
            động và không bị khóa.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Backend sẽ kiểm tra thêm tuyến quản lý và ngăn người nhận tự duyệt đơn
          của mình.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm leading-6">
        <input
          type="checkbox"
          checked={confirmed && Boolean(replacement)}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={isSubmitting || !replacement}
          className="mt-1"
        />
        <span>
          Tôi xác nhận chuyển các trách nhiệm trên từ {user.name} sang{" "}
          {replacement?.name ?? "người được chọn"}.
        </span>
      </label>
      <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-6">
        Ticket và tài sản không được chuyển bằng thao tác này. Hãy{" "}
        <Link className="underline" href="/tickets">
          giao lại ticket
        </Link>{" "}
        và{" "}
        <Link className="underline" href="/assets">
          thu hồi/cấp lại tài sản
        </Link>{" "}
        bằng chức năng hiện có trước khi vô hiệu hóa.
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !replacement || !confirmed}
        >
          {isSubmitting ? "Đang bàn giao..." : "Xác nhận bàn giao"}
        </Button>
      </div>
    </form>
  );
}
