"use client";

import { useParams } from "next/navigation";
import { ErrorBlock } from "@/shared/components/ui/state-block";
import { TicketDetailPanel } from "@/features/tickets/components/ticket-detail-panel";

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = Number(params.id);

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return <ErrorBlock title="Ticket id không hợp lệ" />;
  }

  return <TicketDetailPanel ticketId={ticketId} />;
}
