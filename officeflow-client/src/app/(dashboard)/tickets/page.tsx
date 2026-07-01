import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { TicketsPanel } from "@/features/tickets/components/tickets-panel";

export default function TicketsPage() {
  return (
    <>
      <PageHeader
        title="Tickets"
        actions={
          <Link href="/tickets/new">
            <Button icon={<Plus className="h-4 w-4" />}>Tạo ticket</Button>
          </Link>
        }
      />
      <TicketsPanel />
    </>
  );
}
