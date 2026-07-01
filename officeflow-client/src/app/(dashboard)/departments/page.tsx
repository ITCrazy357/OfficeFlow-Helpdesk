import { PageHeader } from "@/shared/components/ui/page-header";
import { DepartmentsPanel } from "@/features/departments/components/departments-panel";

export default function DepartmentsPage() {
  return (
    <>
      <PageHeader title="Phòng ban" />
      <DepartmentsPanel />
    </>
  );
}
