"use client";

import { ArrowLeft, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  TicketSlaBadge,
} from "./ticket-badges";
import { formatDateTime } from "../ticket-detail.utils";
import type { Ticket } from "../types";

type TicketDetailHeaderProps = {
  ticket: Ticket;
  allowEdit: boolean;
  allowDelete: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  onToggleEditing: () => void;
  onToggleDelete: () => void;
};

export function TicketDetailHeader({
  ticket,
  allowEdit,
  allowDelete,
  isEditing,
  isDeleting,
  onToggleEditing,
  onToggleDelete,
}: TicketDetailHeaderProps) {
  return (
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
          <TicketSlaBadge ticket={ticket} />
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
          <Button type="button" variant="outline" onClick={onToggleEditing}>
            <Edit3 className="size-4" />
            {isEditing ? "Đóng form" : "Sửa ticket"}
          </Button>
        ) : null}
        {allowDelete ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onToggleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Đang xóa..." : "Xóa"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
