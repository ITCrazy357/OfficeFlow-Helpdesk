import { PageHeader } from "@/shared/components/ui/page-header";
import { CreateTicketPanel } from "@/features/tickets/components/create-ticket-panel";

export default function CreateTicketPage() {
  return (
    <>
      <PageHeader title="Tạo ticket" />
      <CreateTicketPanel />
    </>
  );
}
