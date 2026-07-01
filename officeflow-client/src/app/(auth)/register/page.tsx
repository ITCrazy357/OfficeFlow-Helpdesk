import { GuestRoute } from "@/features/auth/components/protected-route";
import { RegisterForm } from "@/features/auth/components/register-form";
import { AuthShell } from "@/features/auth/components/auth-shell";

export default function RegisterPage() {
  return (
    <GuestRoute>
      <AuthShell title="Đăng ký tài khoản">
        <RegisterForm />
      </AuthShell>
    </GuestRoute>
  );
}
