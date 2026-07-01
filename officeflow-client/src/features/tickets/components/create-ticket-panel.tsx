"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { TicketForm } from "@/features/tickets/components/ticket-form";
import { ticketService } from "@/features/tickets/services/ticket-service";
import type { TicketFormValues } from "@/features/tickets/schemas/ticket-schemas";
import { useToast } from "@/shared/components/toast/toast-provider";

export function CreateTicketPanel() {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: TicketFormValues) => {
    setIsSubmitting(true);

    try {
      const ticket = await ticketService.create(values);
      toast.success("Tạo ticket thành công");
      router.push(`/tickets/${ticket.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tạo ticket thất bại";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="max-w-3xl overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03]">
      <div className="flex items-center gap-3 border-b border-zinc-200/80 bg-zinc-50/70 px-5 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <FilePlus2 className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold text-zinc-950">
          Thông tin ticket
        </h2>
      </div>
      <div className="p-5">
      <TicketForm
        submitLabel="Tạo ticket"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
      </div>
    </section>
  );
}
