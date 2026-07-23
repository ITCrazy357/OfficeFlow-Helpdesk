"use client";

import type { CSSProperties, DragEvent } from "react";
import { useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import type { AuthUser } from "@/features/auth/types";
import { getApiErrorMessage } from "@/lib/axios";
import {
  useDeleteTicketAttachment,
  useTicketAttachments,
  useUploadTicketAttachment,
} from "../hooks";
import type { TicketAttachment } from "../types";

const MAX_ATTACHMENT_SIZE_IN_BYTES = 10 * 1024 * 1024;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) {
    return "Không rõ dung lượng";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop();
  return extension ? extension.toUpperCase() : "FILE";
}

function getAttachmentVisual(attachment: TicketAttachment) {
  const fileType = attachment.fileType?.toLowerCase() ?? "";
  const fileName = attachment.fileName.toLowerCase();

  if (fileType.startsWith("image/")) {
    return {
      icon: FileImage,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      label: "Ảnh",
    };
  }

  if (fileType.startsWith("video/")) {
    return {
      icon: FileVideo,
      tone: "bg-sky-50 text-sky-700 ring-sky-100",
      label: "Video",
    };
  }

  if (
    fileType.includes("zip") ||
    fileType.includes("rar") ||
    fileName.endsWith(".zip") ||
    fileName.endsWith(".rar")
  ) {
    return {
      icon: FileArchive,
      tone: "bg-amber-50 text-amber-700 ring-amber-100",
      label: "Nén",
    };
  }

  return {
    icon: FileText,
    tone: "bg-teal-50 text-teal-800 ring-teal-100",
    label: getFileExtension(attachment.fileName),
  };
}

function canDeleteAttachment(
  user: AuthUser | undefined,
  attachment: TicketAttachment,
) {
  if (!user) {
    return false;
  }

  if (user.role === "ADMIN" || user.role === "IT_STAFF") {
    return true;
  }

  if (user.role === "MANAGER") {
    return false;
  }

  return attachment.uploadedBy.id === user.id;
}

type TicketAttachmentsProps = {
  ticketId: number;
  currentUser?: AuthUser;
  enabled?: boolean;
};

export function TicketAttachments({
  ticketId,
  currentUser,
  enabled = true,
}: TicketAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsQuery = useTicketAttachments(ticketId, enabled);
  const uploadAttachment = useUploadTicketAttachment();
  const deleteAttachment = useDeleteTicketAttachment();
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const attachments = attachmentsQuery.data ?? [];
  const isUploading = uploadAttachment.isPending;
  const canUpload = enabled && Boolean(currentUser);

  async function handleFiles(fileList: FileList | null) {
    setUploadError(null);

    if (!fileList?.length) {
      return;
    }

    const files = Array.from(fileList);

    if (files.length > 1) {
      setUploadError("Hiện tại chỉ hỗ trợ tải lên 1 tệp mỗi lần.");
      return;
    }

    const file = files[0];

    if (file.size > MAX_ATTACHMENT_SIZE_IN_BYTES) {
      setUploadError("Tệp vượt quá giới hạn 10 MB của backend.");
      return;
    }

    try {
      await uploadAttachment.mutateAsync({ id: ticketId, file });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setUploadError(
        getApiErrorMessage(error, "Không thể tải tệp lên. Vui lòng thử lại."),
      );
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (canUpload && !isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!canUpload || isUploading) {
      return;
    }

    void handleFiles(event.dataTransfer.files);
  }

  async function handleDelete(attachment: TicketAttachment) {
    setDeleteError(null);
    setDeletingId(attachment.id);

    try {
      await deleteAttachment.mutateAsync({
        id: ticketId,
        attachmentId: attachment.id,
      });
      setConfirmDeleteId(null);
    } catch (error) {
      setDeleteError(
        getApiErrorMessage(error, "Không thể xóa tệp. Vui lòng thử lại."),
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <Paperclip className="mt-1 size-4 text-muted-foreground" />
            <div>
              <CardTitle>Tệp đính kèm</CardTitle>
              <CardDescription>
                Ảnh chụp lỗi, tài liệu hoặc log liên quan đến ticket.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="motion-badge">
            {attachments.length} tệp
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        {canUpload ? (
          <div
            className={cn(
              "rounded-lg border border-dashed bg-muted/25 p-4 transition-colors",
              isDragging
                ? "border-teal-400 bg-teal-50 text-teal-950"
                : "border-border hover:border-teal-200 hover:bg-teal-50/40",
              isUploading && "pointer-events-none opacity-80",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-card text-teal-800 ring-1 ring-border">
                  {isUploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <UploadCloud className="size-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {isUploading ? "Đang tải tệp lên..." : "Kéo thả tệp vào đây"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tối đa 10 MB, tải từng tệp một.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <UploadCloud className="size-4" />
                Chọn tệp
              </Button>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              disabled={isUploading}
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </div>
        ) : null}

        {uploadError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive motion-toast">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        ) : null}

        {deleteError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive motion-toast">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{deleteError}</span>
          </div>
        ) : null}

        {attachmentsQuery.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-20 rounded-lg bg-muted motion-shimmer"
              />
            ))}
          </div>
        ) : attachmentsQuery.isError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">
              Không thể tải danh sách tệp.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => attachmentsQuery.refetch()}
            >
              Thử lại
            </Button>
          </div>
        ) : attachments.length ? (
          <div className="grid gap-3">
            {attachments.map((attachment, index) => {
              const visual = getAttachmentVisual(attachment);
              const Icon = visual.icon;
              const allowDelete = canDeleteAttachment(currentUser, attachment);
              const isConfirmingDelete = confirmDeleteId === attachment.id;
              const isDeleting = deletingId === attachment.id;

              return (
                <div
                  key={attachment.id}
                  className="motion-card rounded-lg border bg-card p-3"
                  style={{ "--motion-index": index } as CSSProperties}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className={cn(
                          "grid size-11 shrink-0 place-items-center rounded-lg ring-1",
                          visual.tone,
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="max-w-full truncate text-sm font-semibold sm:max-w-[360px]">
                            {attachment.fileName}
                          </p>
                          <Badge variant="secondary" className="motion-badge">
                            {visual.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatFileSize(attachment.fileSize)} /{" "}
                          {attachment.uploadedBy.name} /{" "}
                          {formatDateTime(attachment.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button asChild type="button" variant="outline" size="sm">
                        <a
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="size-4" />
                          Mở
                        </a>
                      </Button>
                      <Button asChild type="button" variant="outline" size="sm">
                        <a href={attachment.fileUrl} download>
                          <Download className="size-4" />
                          Tải
                        </a>
                      </Button>
                      {allowDelete ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setConfirmDeleteId((current) =>
                              current === attachment.id ? null : attachment.id,
                            )
                          }
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          Xóa
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {isConfirmingDelete ? (
                    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 motion-toast sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-destructive">
                        Xóa tệp này khỏi ticket?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isDeleting}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDelete(attachment)}
                          disabled={isDeleting}
                        >
                          Xác nhận
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/15 p-6 text-center">
            <Paperclip className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Chưa có tệp đính kèm</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Thêm ảnh chụp màn hình hoặc tài liệu để quá trình xử lý rõ hơn.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
