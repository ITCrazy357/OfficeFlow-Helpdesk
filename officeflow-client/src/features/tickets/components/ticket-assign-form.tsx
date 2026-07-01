"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/shared/components/ui/button";
import { InputField, SelectField } from "@/shared/components/ui/form-field";
import { useToast } from "@/shared/components/toast/toast-provider";
import { useAuth } from "@/features/auth/context/auth-context";
import { userService } from "@/features/users/services/user-service";
import type { User } from "@/features/users/types";
import {
  assignTicketSchema,
  type AssignTicketValues,
} from "@/features/tickets/schemas/ticket-schemas";
import { ticketService } from "@/features/tickets/services/ticket-service";
import type { Ticket } from "@/features/tickets/types";

type TicketAssignFormProps = {
  ticket: Ticket;
  onUpdated: (ticket: Ticket) => void;
};

export function TicketAssignForm({ ticket, onUpdated }: TicketAssignFormProps) {
  const toast = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const canUseUsersApi = user?.role === "ADMIN";
  const assignableUsers = useMemo(
    () =>
      users.filter((item) => item.role === "ADMIN" || item.role === "IT_STAFF"),
    [users],
  );
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<AssignTicketValues>({
    resolver: zodResolver(assignTicketSchema),
    defaultValues: {
      assignedToId: ticket.assignedTo?.id,
    },
  });

  useEffect(() => {
    if (!canUseUsersApi) {
      return;
    }

    let isMounted = true;
    const timer = window.setTimeout(() => {
      setIsUsersLoading(true);

      userService
        .list()
        .then((result) => {
          if (isMounted) {
            setUsers(result);
          }
        })
        .catch(() => {
          if (isMounted) {
            setUsers([]);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsUsersLoading(false);
          }
        });
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [canUseUsersApi]);

  const onSubmit = async (values: AssignTicketValues) => {
    try {
      const updatedTicket = await ticketService.assign(ticket.id, values);
      onUpdated(updatedTicket);
      toast.success("Gán ticket thành công");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gán ticket thất bại";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      {canUseUsersApi ? (
        <SelectField
          label="Người xử lý"
          error={errors.assignedToId?.message}
          disabled={isUsersLoading}
          {...register("assignedToId", {
            setValueAs: (value) => Number(value),
          })}
        >
          <option value="">Chọn người xử lý</option>
          {assignableUsers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} - {item.role}
            </option>
          ))}
        </SelectField>
      ) : (
        <InputField
          label="Assigned user ID"
          type="number"
          min={1}
          error={errors.assignedToId?.message}
          {...register("assignedToId", {
            setValueAs: (value) => Number(value),
          })}
        />
      )}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
        icon={<UserCheck className="h-4 w-4" />}
      >
        {isSubmitting ? "Đang gán" : "Gán ticket"}
      </Button>
    </form>
  );
}
