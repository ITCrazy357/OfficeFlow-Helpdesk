import { PageHeader } from "@/shared/components/ui/page-header";
import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { UsersPanel } from "@/features/users/components/users-panel";

export default function UsersPage() {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      <PageHeader title="Người dùng" />
      <UsersPanel />
    </ProtectedRoute>
  );
}
