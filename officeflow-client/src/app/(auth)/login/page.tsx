import { GuestRoute } from "@/features/auth/components/protected-route";
import { LoginForm } from "@/features/auth/components/login-form";
import { AuthShell } from "@/features/auth/components/auth-shell";

export default function LoginPage() {
  return (
    <GuestRoute>
      <AuthShell title="Đăng nhập tài khoản">
        <LoginForm />
      </AuthShell>
    </GuestRoute>
  );
}
