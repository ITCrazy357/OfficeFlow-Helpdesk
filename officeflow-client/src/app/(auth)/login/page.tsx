"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCheck,
  CircleCheck,
  Eye,
  EyeOff,
  Headset,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { OfficeFlowFigure } from "@/components/ui/officeflow-figure";
import { useLogin } from "@/features/auth/hooks";
import { restoreSessionApi } from "@/features/auth/api";
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas";
import { getApiErrorMessage } from "@/lib/axios";
import styles from "./login.module.css";

const productNotes = [
  {
    icon: CheckCheck,
    title: "Mọi yêu cầu, một nơi theo dõi",
    description: "Nắm rõ trạng thái, tiến độ và mức độ ưu tiên.",
  },
  {
    icon: UsersRound,
    title: "Kết nối đúng người, xử lý đúng việc",
    description: "Phối hợp dễ dàng giữa nhân viên và đội ngũ IT.",
  },
  {
    icon: ShieldCheck,
    title: "Không gian làm việc nội bộ",
    description: "Truy cập tính năng phù hợp với vai trò của bạn.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    let active = true;

    void restoreSessionApi()
      .then((user) => {
        if (active) {
          router.replace(
            user.mustChangePassword ? "/change-password" : "/dashboard",
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsRestoringSession(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const onSubmit: SubmitHandler<LoginFormValues> = async (values) => {
    if (isRestoringSession) {
      return;
    }

    setFormError(null);

    try {
      const result = await loginMutation.mutateAsync(values);
      router.replace(
        result.user.mustChangePassword ? "/change-password" : "/dashboard",
      );
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "Đăng nhập thất bại. Vui lòng thử lại."),
      );
    }
  };

  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  const isBusy = loginMutation.isPending || isRestoringSession;

  return (
    <main className={styles.page}>
      <section className={styles.introduction} aria-labelledby="welcome-title">
        <div className={styles.brand}>
          <LockKeyhole className="size-3.5" aria-hidden="true" />
          <span>OfficeFlow Helpdesk</span>
        </div>
        <div className={`${styles.introContent} motion-enter`}>
          <h1 id="welcome-title" className={styles.headline}>
            Hỗ trợ nội bộ,<br />
            <span>gọn gàng hơn.</span>
          </h1>
          <p className="mt-5 hidden max-w-[29rem] text-base leading-7 text-teal-50/80 sm:block">
            Gửi yêu cầu, theo dõi tiến độ và kết nối với đội ngũ IT.
            Mọi việc trong một không gian chung.
          </p>
          <div className={styles.figure}><OfficeFlowFigure kind="hub" /></div>
          <ul className="mt-4 hidden gap-4 lg:grid">
            {productNotes.map(({ icon: Icon, title, description }) => (
              <li key={title} className={styles.feature}>
                <span className={styles.featureIcon}><Icon className="size-5" aria-hidden="true" /></span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-5 text-teal-50/75">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.introFooter}>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2" aria-hidden="true">
              <span className={`${styles.teamMark} bg-teal-700`}>IT</span>
              <span className={`${styles.teamMark} bg-emerald-800`}>HR</span>
              <span className={`${styles.teamMark} bg-slate-600`}>OP</span>
            </div>
            <span className="text-xs text-teal-50/80">Cùng kết nối. Cùng giải quyết.</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-200">
            <Headset className="size-4" aria-hidden="true" />Hỗ trợ nội bộ
          </span>
        </div>
      </section>

      <section className={styles.formSection} aria-labelledby="login-title">
        <div className={styles.formDecoration} aria-hidden="true" />
        <div className={`${styles.loginCard} motion-enter`}>
          <div className="mb-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className={styles.loginIcon}><LogIn className="size-6" aria-hidden="true" /></div>
              <span className="rounded-full border border-emerald-100 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">Dành cho nội bộ</span>
            </div>
            <h2 id="login-title" className="text-[1.75rem] font-semibold tracking-tight text-foreground">Đăng nhập</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Chào mừng bạn trở lại! Truy cập OfficeFlow bằng tài khoản được cấp.
            </p>
          </div>

          <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)} aria-busy={isBusy} noValidate>
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email công việc</Label>
              <div className={styles.inputWrap}>
                <Mail className={styles.inputIcon} aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="ban@congty.com"
                  className={styles.input}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "email-error" : undefined}
                  disabled={isBusy}
                  {...form.register("email")}
                />
              </div>
              {emailError ? <p id="email-error" role="alert" className="text-xs font-medium text-red-700 dark:text-red-200">{emailError}</p> : null}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-sm font-semibold text-foreground">Mật khẩu</Label>
                <Link href="/forgot-password" className="rounded-sm text-xs font-semibold text-primary hover:underline">Quên mật khẩu?</Link>
              </div>
              <div className={styles.inputWrap}>
                <LockKeyhole className={styles.inputIcon} aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  className={`${styles.input} ${styles.passwordInput}`}
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  disabled={isBusy}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  disabled={isBusy}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
              {passwordError ? <p id="password-error" role="alert" className="text-xs font-medium text-red-700 dark:text-red-200">{passwordError}</p> : null}
            </div>

            {formError ? (
              <div role="alert" className="motion-toast rounded-lg border border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-400/10 px-3 py-2.5 text-sm font-medium text-red-700 dark:text-red-200">{formError}</div>
            ) : null}

            <Button type="submit" className={styles.submitButton} disabled={isBusy}>
              <span aria-live="polite">
                {isRestoringSession ? "Đang kiểm tra phiên..." : loginMutation.isPending ? "Đang đăng nhập..." : "Đăng nhập vào hệ thống"}
              </span>
              {isBusy ? <Loader /> : <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          </form>

          <div className="mt-7 border-t pt-5 text-center">
            <p className="text-xs leading-5 text-muted-foreground">Tài khoản được cấp bởi quản trị viên.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Liên hệ <span className="font-semibold text-primary">đội ngũ IT</span> nếu bạn cần hỗ trợ truy cập.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-emerald-100/80 dark:border-emerald-400/25 bg-emerald-50/70 dark:bg-emerald-400/10 px-3 py-2.5 text-xs font-medium text-teal-800 dark:text-teal-200">
              <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />
              Không gian hỗ trợ dành cho đội ngũ của bạn
            </div>
          </div>
        </div>
        <p className="relative mt-6 text-center text-xs text-muted-foreground">OfficeFlow Helpdesk · Kết nối công việc mỗi ngày</p>
      </section>
    </main>
  );
}
