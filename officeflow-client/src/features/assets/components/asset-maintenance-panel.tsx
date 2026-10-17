"use client";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getApiErrorMessage } from "@/lib/axios";
import { useAssetMaintenance, useSaveAssetMaintenance } from "../care-hooks";
import {
  careToday,
  maintenanceCost,
  maintenanceKinds,
  maintenanceStatuses,
} from "../care-utils";
import type {
  AssetMaintenance,
  MaintenanceInput,
  MaintenanceKind,
  MaintenanceStatus,
} from "../types";

const selectClass =
  "h-10 min-w-0 w-full rounded-lg border border-input bg-card px-3 text-sm";

export default function AssetMaintenancePanel({
  assetId,
  supplierName,
  canSchedule,
}: {
  assetId: number;
  supplierName?: string | null;
  canSchedule: boolean;
}) {
  const uid = useId();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<MaintenanceStatus | "ALL">("ALL");
  const query = useAssetMaintenance(assetId, {
    page,
    limit: 10,
    status: status === "ALL" ? undefined : status,
  });
  const save = useSaveAssetMaintenance(assetId);
  const fresh = (): MaintenanceInput => ({
    title: "",
    kind: "MAINTENANCE",
    scheduledFor: careToday(),
    vendor: supplierName ?? "",
    notes: "",
  });
  const [draft, setDraft] = useState<MaintenanceInput>(fresh);
  const [editing, setEditing] = useState<AssetMaintenance | null>(null);
  const [completing, setCompleting] = useState<AssetMaintenance | null>(null);
  const [performedOn, setPerformedOn] = useState(careToday);
  const [cost, setCost] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{
    error: boolean;
    text: string;
  } | null>(null);

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    setFeedback(null);
    try {
      const input = {
        ...draft,
        title: draft.title.trim(),
        vendor: draft.vendor?.trim() || null,
        notes: draft.notes?.trim() || null,
      };
      await save.mutateAsync(
        editing
          ? {
              action: "update",
              id: editing.id,
              input: { ...input, version: editing.version },
            }
          : { action: "create", input },
      );
      setEditing(null);
      setDraft(fresh());
      setFeedback({ error: false, text: "Đã lưu lịch bảo trì." });
    } catch (error) {
      setFeedback({
        error: true,
        text: getApiErrorMessage(
          error,
          "Không thể lưu lịch. Nếu dữ liệu đã thay đổi, tải lại và chọn lịch mới nhất.",
        ),
      });
    }
  }

  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completing || save.isPending) return;
    setFeedback(null);
    try {
      await save.mutateAsync({
        action: "complete",
        id: completing.id,
        input: {
          version: completing.version,
          performedOn,
          cost: cost || null,
          vendor: vendor.trim() || null,
          notes: notes.trim() || null,
        },
      });
      setCompleting(null);
      setFeedback({
        error: false,
        text: "Đã ghi nhận hoàn tất. Lịch sử và chi phí được giữ lại.",
      });
    } catch (error) {
      setFeedback({
        error: true,
        text: getApiErrorMessage(
          error,
          "Không thể ghi nhận hoàn tất. Hãy tải lại lịch trước khi thử lại.",
        ),
      });
    }
  }

  async function cancel(record: AssetMaintenance) {
    if (save.isPending) return;
    try {
      await save.mutateAsync({
        action: "cancel",
        id: record.id,
        input: { version: record.version },
      });
      setFeedback({
        error: false,
        text: "Đã hủy lịch. Bản ghi vẫn được giữ trong lịch sử.",
      });
    } catch (error) {
      setFeedback({
        error: true,
        text: getApiErrorMessage(error, "Không thể hủy lịch."),
      });
    }
  }

  const records = query.isError ? [] : (query.data?.items ?? []);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Bảo trì và lịch sử sửa chữa</CardTitle>
        <CardDescription>
          Lập lịch không tự đổi trạng thái/cấp phát tài sản. Khi hoàn tất, ghi
          ngày thực hiện, nhà cung cấp và chi phí VND; bản ghi đã chốt không sửa
          lại.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {feedback && (
          <p
            role={feedback.error ? "alert" : "status"}
            className={`rounded-lg border p-3 text-sm ${feedback.error ? "text-destructive" : "text-foreground"}`}
          >
            {feedback.text}
          </p>
        )}
        {(canSchedule || editing) && (
          <form
            onSubmit={schedule}
            className="grid gap-3 rounded-lg border p-4"
            aria-label={editing ? "Chỉnh lịch bảo trì" : "Lập lịch bảo trì"}
          >
            <h3 className="font-medium">
              {editing
                ? `Sửa lịch #${editing.id}`
                : "Lập lịch bảo trì / sửa chữa"}
            </h3>
            <label
              className="grid min-w-0 gap-1.5 text-sm"
              htmlFor={`${uid}-title`}
            >
              Nội dung
              <Input
                id={`${uid}-title`}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
                minLength={2}
                maxLength={150}
                disabled={save.isPending}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className="grid min-w-0 gap-1.5 text-sm"
                htmlFor={`${uid}-kind`}
              >
                Loại công việc
                <select
                  id={`${uid}-kind`}
                  className={selectClass}
                  value={draft.kind}
                  disabled={save.isPending}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      kind: e.target.value as MaintenanceKind,
                    })
                  }
                >
                  {Object.entries(maintenanceKinds).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="grid min-w-0 gap-1.5 text-sm"
                htmlFor={`${uid}-schedule`}
              >
                Ngày dự kiến
                <Input
                  id={`${uid}-schedule`}
                  type="date"
                  required
                  value={draft.scheduledFor}
                  disabled={save.isPending}
                  onChange={(e) =>
                    setDraft({ ...draft, scheduledFor: e.target.value })
                  }
                />
              </label>
            </div>
            <label
              className="grid min-w-0 gap-1.5 text-sm"
              htmlFor={`${uid}-vendor`}
            >
              Đơn vị thực hiện
              <Input
                id={`${uid}-vendor`}
                value={draft.vendor ?? ""}
                maxLength={150}
                disabled={save.isPending}
                onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
              />
            </label>
            <label
              className="grid min-w-0 gap-1.5 text-sm"
              htmlFor={`${uid}-notes`}
            >
              Ghi chú lịch
              <Textarea
                id={`${uid}-notes`}
                value={draft.notes ?? ""}
                maxLength={2000}
                disabled={save.isPending}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending}>
                {editing ? "Lưu lịch đã sửa" : "Tạo lịch"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => {
                    setEditing(null);
                    setDraft(fresh());
                  }}
                >
                  Bỏ chỉnh sửa
                </Button>
              )}
            </div>
          </form>
        )}
        {!canSchedule && (
          <p className="text-sm text-muted-foreground">
            Tài sản đã thanh lý hoặc bị mất: không lập lịch mới, vẫn xem và chốt
            các lịch đã có.
          </p>
        )}
        {completing && (
          <form
            onSubmit={complete}
            className="grid gap-3 rounded-lg border p-4"
            aria-label="Ghi nhận hoàn tất"
          >
            <h3 className="font-medium">Hoàn tất: {completing.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className="grid min-w-0 gap-1.5 text-sm"
                htmlFor={`${uid}-performed`}
              >
                Ngày thực hiện
                <Input
                  id={`${uid}-performed`}
                  type="date"
                  required
                  max={careToday()}
                  value={performedOn}
                  disabled={save.isPending}
                  onChange={(e) => setPerformedOn(e.target.value)}
                />
              </label>
              <label
                className="grid min-w-0 gap-1.5 text-sm"
                htmlFor={`${uid}-cost`}
              >
                Chi phí thực tế (VND)
                <Input
                  id={`${uid}-cost`}
                  inputMode="numeric"
                  pattern="0|[1-9][0-9]{0,11}"
                  maxLength={12}
                  placeholder="Để trống nếu chưa ghi nhận"
                  value={cost}
                  disabled={save.isPending}
                  onChange={(e) => setCost(e.target.value)}
                />
              </label>
            </div>
            <label
              className="grid min-w-0 gap-1.5 text-sm"
              htmlFor={`${uid}-actual-vendor`}
            >
              Nhà cung cấp dịch vụ
              <Input
                id={`${uid}-actual-vendor`}
                value={vendor}
                maxLength={150}
                disabled={save.isPending}
                onChange={(e) => setVendor(e.target.value)}
              />
            </label>
            <label
              className="grid min-w-0 gap-1.5 text-sm"
              htmlFor={`${uid}-result`}
            >
              Kết quả và ghi chú
              <Textarea
                id={`${uid}-result`}
                value={notes}
                maxLength={2000}
                disabled={save.isPending}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending}>
                Xác nhận hoàn tất
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => setCompleting(null)}
              >
                Bỏ ghi nhận
              </Button>
            </div>
          </form>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label
            className="grid min-w-0 gap-1.5 text-sm"
            htmlFor={`${uid}-status`}
          >
            Lọc lịch sử
            <select
              id={`${uid}-status`}
              className={selectClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as MaintenanceStatus | "ALL");
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(maintenanceStatuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            Tải lại lịch
          </Button>
        </div>
        {query.isLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Đang tải lịch sử bảo trì…
          </p>
        )}
        {query.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(query.error, "Không thể tải lịch sử bảo trì.")}
          </p>
        )}
        {!query.isLoading && !query.isError && !records.length && (
          <p className="text-sm text-muted-foreground">
            Chưa có bản ghi phù hợp.
          </p>
        )}
        <ul className="grid gap-3">
          {records.map((record) => (
            <li key={record.id} className="grid gap-2 rounded-lg border p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="min-w-0 break-words font-medium">
                  {record.title}
                </h3>
                <Badge variant="outline">
                  {maintenanceStatuses[record.status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                #{record.id} · {maintenanceKinds[record.kind]} · Dự kiến{" "}
                {record.scheduledFor.slice(0, 10)}
                {record.status === "PLANNED" &&
                record.scheduledFor.slice(0, 10) < careToday()
                  ? " · Quá ngày dự kiến"
                  : ""}
              </p>
              <p className="break-words text-sm">
                Nhà cung cấp: {record.vendor || "Chưa ghi nhận"}
              </p>
              {record.status === "COMPLETED" && (
                <p className="text-sm">
                  Thực hiện {record.performedOn?.slice(0, 10)} · Chi phí:{" "}
                  {maintenanceCost(record.cost)}
                </p>
              )}
              {record.notes && (
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {record.notes}
                </p>
              )}
              {record.status === "PLANNED" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={save.isPending}
                    onClick={() => {
                      setEditing(record);
                      setDraft({
                        title: record.title,
                        kind: record.kind,
                        scheduledFor: record.scheduledFor.slice(0, 10),
                        vendor: record.vendor,
                        notes: record.notes,
                      });
                      setCompleting(null);
                      setFeedback(null);
                    }}
                  >
                    Sửa lịch
                  </Button>
                  <Button
                    size="sm"
                    disabled={save.isPending}
                    onClick={() => {
                      setCompleting(record);
                      setPerformedOn(careToday());
                      setCost("");
                      setVendor(record.vendor ?? supplierName ?? "");
                      setNotes(record.notes ?? "");
                      setFeedback(null);
                    }}
                  >
                    Ghi nhận hoàn tất
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={save.isPending}
                    onClick={() => void cancel(record)}
                  >
                    Hủy lịch
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            Trang {page} · {query.data?.pagination.totalItems ?? 0} bản ghi
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                query.isFetching ||
                page >= (query.data?.pagination.totalPages ?? 0)
              }
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
