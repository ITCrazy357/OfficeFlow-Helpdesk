"use client";
import { UserActionPanel } from "@/features/users/components/user-action-panel";
import { UserList } from "@/features/users/components/user-list";
import type { UserPanel } from "@/features/users/user-panel";

import {
  AlertCircle,
  CircleCheck,
  MailCheck,
  Plus,
  Shield,
  UserCheck,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMe } from "@/features/auth/hooks";
import { useDepartments } from "@/features/departments/hooks";
import {
  useChangeAccountLock,
  useChangeUserStatus,
  useCreateUser,
  useHandoffUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from "@/features/users/hooks";
import { translateLifecycleMessage } from "@/features/users/lifecycle";
import type {
  ResetPasswordFormValues,
  UserFormValues,
} from "@/features/users/schemas";
import { getApiErrorMessage } from "@/lib/axios";

function UsersSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-0">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-14 rounded-lg bg-muted motion-shimmer"
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default function UsersPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN";
  const canManageAccountLocks = isAdmin || me?.role === "IT_STAFF";
  const usersQuery = useUsers(canManageAccountLocks);
  const departmentsQuery = useDepartments(isAdmin);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const changeAccountLock = useChangeAccountLock();
  const changeUserStatus = useChangeUserStatus();
  const resetUserPassword = useResetUserPassword();
  const handoffUser = useHandoffUser();
  const isActionPending =
    createUser.isPending ||
    updateUser.isPending ||
    changeAccountLock.isPending ||
    changeUserStatus.isPending ||
    resetUserPassword.isPending ||
    handoffUser.isPending;
  const [panel, setPanel] = useState<UserPanel>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const handoffResultButtonRef = useRef<HTMLButtonElement>(null);

  const openPanel = (nextPanel: NonNullable<UserPanel>) => {
    if (isActionPending) return;
    setActionError(null);
    setActionMessage(null);
    setPanel(nextPanel);
  };

  const closePanel = () => {
    if (isActionPending) return;
    setActionError(null);
    setPanel(null);
  };

  const handleCreate = async (values: UserFormValues) => {
    setActionError(null);

    try {
      await createUser.mutateAsync({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        departmentId: Number(values.departmentId),
      });
      setPanel(null);
      setActionMessage(
        `Đã tạo tài khoản ${values.email}. Email thông báo sẽ được gửi nếu tính năng email đang bật.`,
      );
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "Không thể tạo tài khoản người dùng."),
      );
    }
  };

  const handleUpdate = async (values: UserFormValues) => {
    if (!panel || panel.type !== "edit") {
      return;
    }

    setActionError(null);

    try {
      await updateUser.mutateAsync({
        id: panel.user.id,
        input: {
          name: values.name,
          email: values.email,
          role: values.role,
          departmentId: Number(values.departmentId),
        },
      });
      setPanel(null);
      setActionMessage(`Đã cập nhật tài khoản ${values.email}.`);
    } catch (error) {
      setActionError(
        translateLifecycleMessage(
          getApiErrorMessage(error, "Không thể cập nhật người dùng."),
        ),
      );
    }
  };

  const handleResetPassword = async (values: ResetPasswordFormValues) => {
    if (!panel || panel.type !== "reset") {
      return;
    }

    setActionError(null);

    try {
      await resetUserPassword.mutateAsync({
        id: panel.user.id,
        input: {
          password: values.password,
        },
      });

      setPanel(null);
      setActionMessage(
        `Đã đặt lại mật khẩu cho ${panel.user.email}. Email thông báo sẽ được gửi nếu tính năng email đang bật.`,
      );
    } catch (error) {
      setActionError(getApiErrorMessage(error, "Không thể đặt lại mật khẩu."));
    }
  };

  const handleChangeAccountLock = async () => {
    if (!panel || panel.type !== "lock") {
      return;
    }

    const nextLockedState = !panel.user.isLocked;
    setActionError(null);

    try {
      await changeAccountLock.mutateAsync({
        id: panel.user.id,
        input: {
          isLocked: nextLockedState,
        },
      });
      setPanel(null);
      setActionMessage(
        nextLockedState
          ? `Đã khóa tài khoản ${panel.user.email}.`
          : `Đã mở khóa tài khoản ${panel.user.email}.`,
      );
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "Không thể thay đổi trạng thái tài khoản."),
      );
    }
  };

  const handleChangeActivationStatus = async () => {
    if (!panel || panel.type !== "activation") {
      return;
    }

    const nextActiveState = !panel.user.isActive;
    setActionError(null);

    try {
      await changeUserStatus.mutateAsync({
        id: panel.user.id,
        input: {
          isActive: nextActiveState,
        },
      });
      setPanel(null);
      setActionMessage(
        nextActiveState
          ? `Đã kích hoạt lại nhân viên ${panel.user.email}.`
          : `Đã vô hiệu hóa nhân viên ${panel.user.email}.`,
      );
    } catch (error) {
      setActionError(
        translateLifecycleMessage(
          getApiErrorMessage(error, "Không thể thay đổi trạng thái nhân viên."),
        ),
      );
    }
  };

  const handleHandoff = async (replacementId: number) => {
    if (!isAdmin || panel?.type !== "handoff" || isActionPending) return;
    setActionError(null);
    setHandoffNotice(null);
    const recipient = usersQuery.data?.find(
      (user) => user.id === replacementId,
    );
    try {
      const result = await handoffUser.mutateAsync({
        id: panel.user.id,
        input: { replacementId },
      });
      const hasTransfers =
        result.reportsTransferred > 0 || result.approvalsTransferred > 0;
      const message = hasTransfers
        ? `Đã chuyển ${result.reportsTransferred} nhân viên trực thuộc và ${result.approvalsTransferred} đơn nghỉ chờ duyệt từ ${panel.user.email} sang ${recipient?.email ?? `người dùng #${result.replacementId}`}.`
        : `${panel.user.email} không còn nhân viên trực thuộc hoặc đơn nghỉ chờ duyệt cần bàn giao.`;
      setPanel(null);
      setActionMessage(
        `${message} Tài khoản chưa bị vô hiệu hóa; ticket và tài sản vẫn cần xử lý riêng.`,
      );
      setHandoffNotice({
        title: hasTransfers
          ? "Bàn giao thành công"
          : "Không có trách nhiệm cần bàn giao",
        message,
      });
    } catch (error) {
      setActionError(
        translateLifecycleMessage(
          getApiErrorMessage(error, "Không thể bàn giao. Vui lòng thử lại."),
        ),
      );
    }
  };

  const handoffResultDialog = (
    <AlertDialog
      open={handoffNotice !== null}
      onOpenChange={(open) => {
        if (!open) setHandoffNotice(null);
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          handoffResultButtonRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200">
            <CircleCheck className="size-6" aria-hidden="true" />
          </div>
          <AlertDialogTitle>{handoffNotice?.title}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            {handoffNotice?.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="rounded-lg border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
          Tài khoản chưa bị vô hiệu hóa. Ticket và tài sản cần được xử lý riêng.
        </p>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Button ref={handoffResultButtonRef} type="button">
              Đã hiểu
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (me && !canManageAccountLocks) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-enter">
        <CardContent className="flex items-start gap-3 pt-0">
          <div className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <Shield className="size-5" />
          </div>
          <div>
            <CardTitle>Không có quyền truy cập</CardTitle>
            <CardDescription className="mt-1">
              Chỉ ADMIN hoặc IT_STAFF có quyền truy cập quản lý tài khoản.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!me || usersQuery.isLoading) {
    return <UsersSkeleton />;
  }

  if (usersQuery.isError) {
    return (
      <div className="grid gap-6">
        {handoffResultDialog}
        <Card className="border-destructive/20 bg-destructive/5 motion-enter">
          <CardContent className="flex items-start gap-3 pt-0">
            <div className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <CardTitle>Không thể tải người dùng</CardTitle>
              <CardDescription className="mt-1">
                {getApiErrorMessage(
                  usersQuery.error,
                  "Không thể tải danh sách người dùng.",
                )}
              </CardDescription>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const users = usersQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const loginEnabledCount = users.filter(
    (user) => user.isActive && !user.isLocked,
  ).length;
  const managementCount = users.filter(
    (user) => user.role === "ADMIN" || user.role === "MANAGER",
  ).length;
  const isSavingUser = createUser.isPending || updateUser.isPending;
  const departmentError = departmentsQuery.isError
    ? "Không thể tải danh sách phòng ban."
    : null;

  return (
    <div className="grid gap-6 motion-enter">
      {handoffResultDialog}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Quản lý người dùng
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cấp tài khoản nội bộ, phân quyền và kiểm soát trạng thái đăng nhập.
          </p>
        </div>

        {isAdmin ? (
          <Button
            type="button"
            disabled={isActionPending}
            onClick={() => openPanel({ type: "create" })}
          >
            <Plus className="size-4" />
            Tạo tài khoản
          </Button>
        ) : null}
      </section>

      {actionMessage ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-teal-200 dark:border-teal-400/25 bg-teal-50 dark:bg-teal-400/10 px-4 py-3 text-sm font-medium text-teal-800 dark:text-teal-200 motion-toast"
        >
          <MailCheck className="mt-0.5 size-4 shrink-0" />
          <p className="leading-5">{actionMessage}</p>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Tổng tài khoản", users.length],
          ["Có thể đăng nhập", loginEnabledCount],
          ["Admin / Manager", managementCount],
        ].map(([label, value], index) => (
          <Card
            key={label}
            className="motion-card shadow-sm"
            style={{ "--motion-index": index } as CSSProperties}
          >
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                {value}
                {index === 1 ? (
                  <UserCheck className="size-5 text-teal-800 dark:text-teal-200" />
                ) : null}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section
        className={
          panel
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]"
            : undefined
        }
      >
        <UserList
          users={users}
          isActionPending={isActionPending}
          isAdmin={isAdmin}
          openPanel={openPanel}
          me={me}
        />

        {panel &&
        (isAdmin || panel.type === "lock" || panel.type === "reset") ? (
          <UserActionPanel
            panel={panel}
            users={users}
            handoffUser={handoffUser}
            actionError={actionError}
            handleHandoff={handleHandoff}
            closePanel={closePanel}
            isAdmin={isAdmin}
            isActionPending={isActionPending}
            openPanel={openPanel}
            departments={departments}
            departmentsQuery={departmentsQuery}
            isSavingUser={isSavingUser}
            departmentError={departmentError}
            handleCreate={handleCreate}
            me={me}
            handleUpdate={handleUpdate}
            resetUserPassword={resetUserPassword}
            handleResetPassword={handleResetPassword}
            changeUserStatus={changeUserStatus}
            changeAccountLock={changeAccountLock}
            handleChangeActivationStatus={handleChangeActivationStatus}
            handleChangeAccountLock={handleChangeAccountLock}
          />
        ) : null}
      </section>
    </div>
  );
}
