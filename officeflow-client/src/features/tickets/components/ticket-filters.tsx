"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { InputField, SelectField } from "@/shared/components/ui/form-field";
import {
  ticketPriorities,
  ticketStatuses,
  type TicketFilters,
  type TicketPriority,
  type TicketStatus,
} from "@/features/tickets/types";

type TicketFiltersProps = {
  filters: TicketFilters;
  onChange: (filters: TicketFilters) => void;
};

export function TicketFiltersBar({ filters, onChange }: TicketFiltersProps) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-950">Bộ lọc</h2>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end">
        <InputField
          label="Từ khóa"
          value={filters.keyword ?? ""}
          onChange={(event) =>
            onChange({ ...filters, page: 1, keyword: event.target.value })
          }
        />
        <SelectField
          label="Trạng thái"
          value={filters.status ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              status: (event.target.value || undefined) as
                | TicketStatus
                | undefined,
            })
          }
        >
          <option value="">Tất cả</option>
          {ticketStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Ưu tiên"
          value={filters.priority ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              priority: (event.target.value || undefined) as
                | TicketPriority
                | undefined,
            })
          }
        >
          <option value="">Tất cả</option>
          {ticketPriorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Category ID"
          type="number"
          min={1}
          value={filters.categoryId ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              categoryId: event.target.value
                ? Number(event.target.value)
                : undefined,
            })
          }
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:justify-end">
          <Button
            variant="secondary"
            icon={<Search className="h-4 w-4" />}
            onClick={() => onChange({ ...filters, page: 1 })}
          >
            Lọc
          </Button>
          <Button
            variant="ghost"
            icon={<X className="h-4 w-4" />}
            onClick={() => onChange({ page: 1, limit: filters.limit })}
          >
            Xóa
          </Button>
        </div>
      </div>
    </section>
  );
}
