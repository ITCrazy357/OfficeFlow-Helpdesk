"use client";

import { useEffect } from "react";
import {
  AlertCircle,
  CalendarClock,
  Database,
  Loader2,
  MonitorSmartphone,
  Network,
  ScrollText,
  UserRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  formatAuditLogDate,
  getAuditLogActionMeta,
  getAuditLogEntityLabel,
} from "../constants";
import { useAuditLog } from "../hooks";
import { getApiErrorMessage } from "@/lib/axios";

type AuditLogDetailDrawerProps = {
  auditLogId: number | null;
  onClose: () => void;
};

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b py-3 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-teal-800">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function JsonSnapshot({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  const hasValue = value !== undefined && value !== null;

  return (
    <section className="border-t px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <Database className="size-4 text-teal-800" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {hasValue ? (
        <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/55 p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-words">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Không có dữ liệu.
        </p>
      )}
    </section>
  );
}

export function AuditLogDetailDrawer({
  auditLogId,
  onClose,
}: AuditLogDetailDrawerProps) {
  const auditLogQuery = useAuditLog(
    auditLogId ?? 0,
    auditLogId !== null && auditLogId > 0,
  );

  useEffect(() => {
    if (auditLogId === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [auditLogId, onClose]);

  if (auditLogId === null) {
    return null;
  }

  const auditLog = auditLogQuery.data;
  const actionMeta = auditLog
    ? getAuditLogActionMeta(auditLog.action)
    : null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px] animate-in fade-in duration-200"
        aria-label="Đóng chi tiết nhật ký"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-log-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-hidden border-l bg-card shadow-2xl shadow-foreground/20 animate-in slide-in-from-right-5 duration-300"
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800">
              <ScrollText className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Chi tiết Audit Log
              </p>
              <h2
                id="audit-log-drawer-title"
                className="mt-1 text-lg font-semibold"
              >
                Nhật ký #{auditLogId}
              </h2>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {auditLogQuery.isLoading ? (
            <div className="grid min-h-80 place-items-center px-5 text-center">
              <div>
                <Loader2 className="mx-auto size-6 animate-spin text-teal-800" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Đang tải chi tiết...
                </p>
              </div>
            </div>
          ) : auditLogQuery.isError ? (
            <div className="m-5 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Không thể tải chi tiết
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getApiErrorMessage(
                      auditLogQuery.error,
                      "Không thể tải Audit Log.",
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => auditLogQuery.refetch()}
                  >
                    Thử lại
                  </Button>
                </div>
              </div>
            </div>
          ) : auditLog ? (
            <>
              <section className="px-5 py-5">
                <div className="flex flex-wrap gap-2">
                  {actionMeta ? (
                    <Badge
                      variant="outline"
                      className={cn("motion-badge", actionMeta.className)}
                    >
                      {actionMeta.label}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="motion-badge">
                    {getAuditLogEntityLabel(auditLog.entity)}
                    {auditLog.entityId ? ` #${auditLog.entityId}` : ""}
                  </Badge>
                </div>

                <p className="mt-4 text-sm leading-6">
                  {auditLog.description}
                </p>

                <div className="mt-5">
                  <DetailRow
                    icon={CalendarClock}
                    label="Thời gian"
                    value={formatAuditLogDate(auditLog.createdAt)}
                  />
                  <DetailRow
                    icon={UserRound}
                    label="Người thực hiện"
                    value={
                      auditLog.actor
                        ? `${auditLog.actor.name} · ${auditLog.actor.email}`
                        : "Người dùng đã bị xóa hoặc hệ thống"
                    }
                  />
                  <DetailRow
                    icon={Database}
                    label="Tài nguyên"
                    value={`${getAuditLogEntityLabel(auditLog.entity)}${
                      auditLog.entityId ? ` #${auditLog.entityId}` : ""
                    }`}
                  />
                  <DetailRow
                    icon={Network}
                    label="Địa chỉ IP"
                    value={auditLog.ipAddress || "Không ghi nhận"}
                  />
                  <DetailRow
                    icon={MonitorSmartphone}
                    label="User Agent"
                    value={auditLog.userAgent || "Không ghi nhận"}
                  />
                </div>
              </section>

              <JsonSnapshot title="Dữ liệu trước thay đổi" value={auditLog.oldValues} />
              <JsonSnapshot title="Dữ liệu sau thay đổi" value={auditLog.newValues} />
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
