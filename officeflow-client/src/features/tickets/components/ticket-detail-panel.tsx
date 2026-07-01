"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  FolderOpen,
  PencilLine,
  Settings2,
  Trash2,
  UserCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
} from "@/shared/components/ui/state-block";
import { useToast } from "@/shared/components/toast/toast-provider";
import { formatDate } from "@/shared/lib/format";
import { useAuth } from "@/features/auth/context/auth-context";
import type { AuthUser } from "@/features/auth/types";
import { TicketForm } from "@/features/tickets/components/ticket-form";
import { TicketAssignForm } from "@/features/tickets/components/ticket-assign-form";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/features/tickets/components/ticket-badges";
import { TicketStatusForm } from "@/features/tickets/components/ticket-status-form";
import { ticketService } from "@/features/tickets/services/ticket-service";
import type { TicketFormValues } from "@/features/tickets/schemas/ticket-schemas";
import type { Ticket } from "@/features/tickets/types";

function canUpdateTicket(user: AuthUser | null, ticket: Ticket) {
  if (!user) {
    return false;
  }

  if (user.role !== "EMPLOYEE") {
    return true;
  }

  return ticket.createdBy.id === user.id && ticket.status === "OPEN";
}

function canDeleteTicket(user: AuthUser | null, ticket: Ticket) {
  if (!user) {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  return (
    user.role === "EMPLOYEE" &&
    ticket.createdBy.id === user.id &&
    ticket.status === "OPEN"
  );
}

function canManageTicket(user: AuthUser | null) {
  return user?.role === "ADMIN" || user?.role === "IT_STAFF";
}

export function TicketDetailPanel({ ticketId }: { ticketId: number }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadTicket = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await ticketService.getById(ticketId);
      setTicket(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được chi tiết ticket",
      );
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTicket();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadTicket]);

  const handleUpdate = async (values: TicketFormValues) => {
    setIsUpdating(true);

    try {
      const updatedTicket = await ticketService.update(ticketId, values);
      setTicket(updatedTicket);
      toast.success("Cập nhật ticket thành công");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Cập nhật ticket thất bại";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!ticket) {
      return;
    }

    const confirmed = window.confirm(`Xóa ticket "${ticket.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await ticketService.delete(ticket.id);
      toast.success("Xóa ticket thành công");
      router.push("/tickets");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Xóa ticket thất bại";
      toast.error(message);
    }
  };

  if (isLoading) {
    return <LoadingBlock title="Đang tải chi tiết ticket" />;
  }

  if (error) {
    return (
      <ErrorBlock
        title="Không tải được chi tiết ticket"
        message={error}
        action={
          <Button variant="secondary" onClick={() => void loadTicket()}>
            Thử lại
          </Button>
        }
      />
    );
  }

  if (!ticket) {
    return <EmptyBlock title="Không có dữ liệu ticket" />;
  }

  const infoCards = [
    {
      icon: UserRound,
      label: "Người tạo",
      value: ticket.createdBy.name,
    },
    {
      icon: UserCheck,
      label: "Người xử lý",
      value: ticket.assignedTo?.name ?? "-",
    },
    {
      icon: FolderOpen,
      label: "Category",
      value: ticket.category?.name ?? "-",
    },
    {
      icon: CalendarClock,
      label: "Cập nhật",
      value: formatDate(ticket.updatedAt),
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="motion-enter flex flex-wrap items-center justify-between gap-3">
        <Link href="/tickets">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
            Quay lại
          </Button>
        </Link>
        {canDeleteTicket(user, ticket) ? (
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => void handleDelete()}
          >
            Xóa ticket
          </Button>
        ) : null}
      </div>

      <section className="motion-panel overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03]">
        <div className="bg-zinc-950 px-5 py-5 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-teal-300">
                Ticket #{ticket.id}
              </p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">
                {ticket.title}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-700">
            {ticket.description}
          </p>

          <dl className="grid gap-3 border-t border-zinc-200/80 pt-5 sm:grid-cols-2 xl:grid-cols-4">
            {infoCards.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  style={{ "--motion-index": index } as CSSProperties}
                  className="motion-card rounded-xl bg-zinc-50 p-3.5 ring-1 ring-zinc-950/[0.03]"
                >
                  <dt className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-zinc-950">
                    {item.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        {canUpdateTicket(user, ticket) ? (
          <section className="motion-panel overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03]">
            <div className="flex items-center gap-3 border-b border-zinc-200/80 bg-zinc-50/70 px-5 py-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <PencilLine className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-zinc-950">
                Cập nhật ticket
              </h2>
            </div>
            <div className="p-5">
              <TicketForm
                key={ticket.updatedAt}
                submitLabel="Lưu thay đổi"
                isSubmitting={isUpdating}
                defaultValues={{
                  title: ticket.title,
                  description: ticket.description,
                  priority: ticket.priority,
                  categoryId: ticket.category?.id,
                }}
                onSubmit={handleUpdate}
              />
            </div>
          </section>
        ) : null}

        {canManageTicket(user) ? (
          <div className="grid gap-5">
            <section className="motion-panel overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03]">
              <div className="flex items-center gap-3 border-b border-zinc-200/80 bg-zinc-50/70 px-5 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
                  <Settings2 className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-zinc-950">
                  Đổi trạng thái
                </h2>
              </div>
              <div className="p-5">
                <TicketStatusForm ticket={ticket} onUpdated={setTicket} />
              </div>
            </section>

            <section className="motion-panel overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03]">
              <div className="flex items-center gap-3 border-b border-zinc-200/80 bg-zinc-50/70 px-5 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700">
                  <UserCheck className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-zinc-950">
                  Assign ticket
                </h2>
              </div>
              <div className="p-5">
                <TicketAssignForm ticket={ticket} onUpdated={setTicket} />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
