"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/shared/components/ui/button";
import { SelectField } from "@/shared/components/ui/form-field";
import { useToast } from "@/shared/components/toast/toast-provider";
import {
  ticketStatusSchema,
  type TicketStatusValues,
} from "@/features/tickets/schemas/ticket-schemas";
import { ticketService } from "@/features/tickets/services/ticket-service";
import { ticketStatuses, type Ticket } from "@/features/tickets/types";

type TicketStatusFormProps = {
  ticket: Ticket;
  onUpdated: (ticket: Ticket) => void;
};

export function TicketStatusForm({ ticket, onUpdated }: TicketStatusFormProps) {
  const toast = useToast();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<TicketStatusValues>({
    resolver: zodResolver(ticketStatusSchema),
    defaultValues: {
      status: ticket.status,
    },
  });

  const onSubmit = async (values: TicketStatusValues) => {
    try {
      const updatedTicket = await ticketService.updateStatus(ticket.id, values);
      onUpdated(updatedTicket);
      toast.success("Cập nhật trạng thái thành công");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cập nhật trạng thái thất bại";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="motion-enter grid gap-4">
      <SelectField
        label="Trạng thái"
        error={errors.status?.message}
        {...register("status")}
      >
        {ticketStatuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </SelectField>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
        icon={<RefreshCw className="h-4 w-4" />}
      >
        {isSubmitting ? "Đang cập nhật" : "Cập nhật trạng thái"}
      </Button>
    </form>
  );
}
