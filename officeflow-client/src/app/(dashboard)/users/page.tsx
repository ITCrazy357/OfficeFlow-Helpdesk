"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  KeyRound,
  Lock,
  LockOpen,
  MailCheck,
  Pencil,
  Plus,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLogout, useMe } from "@/features/auth/hooks";
import { useDepartments } from "@/features/departments/hooks";
import { ResetPasswordForm } from "@/features/users/components/reset-password-form";
import { UserForm } from "@/features/users/components/user-form";
import { userRoleLabels } from "@/features/users/constants";
import {
  useChangeAccountLock,
  useChangeUserStatus,
  useCreateUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from "@/features/users/hooks";
import type {
  ResetPasswordFormValues,
  UserFormValues,
} from "@/features/users/schemas";
import type { UserListItem } from "@/features/users/types";
import { getApiErrorMessage } from "@/lib/axios";

type UserPanel =
  | { type: "create" }
  | { type: "edit"; user: UserListItem }
  | { type: "reset"; user: UserListItem }
  | { type: "activation"; user: UserListItem }
  | { type: "lock"; user: UserListItem }
  | null;

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
  }).format(date);
}

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
  const router = useRouter();
  const { data: me } = useMe();
  const logout = useLogout();
  const isAdmin = me?.role === "ADMIN";
  const canManageAccountLocks = isAdmin || me?.role === "IT_STAFF";
  const usersQuery = useUsers(canManageAccountLocks);
  const departmentsQuery = useDepartments(isAdmin);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const changeAccountLock = useChangeAccountLock();
  const changeUserStatus = useChangeUserStatus();
  const resetUserPassword = useResetUserPassword();
  const [panel, setPanel] = useState<UserPanel>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const openPanel = (nextPanel: NonNullable<UserPanel>) => {
    setActionError(null);
    setActionMessage(null);
    setPanel(nextPanel);
  };

  const closePanel = () => {
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
        getApiErrorMessage(error, "Không thể cập nhật người dùng."),
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

      if (panel.user.id === me?.id) {
        await logout().catch(() => undefined);
        router.replace("/login");
        return;
      }

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
        getApiErrorMessage(error, "Không thể thay đổi trạng thái nhân viên."),
      );
    }
  };

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
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" />
            Quản trị hệ thống
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Quản lý người dùng
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cấp tài khoản nội bộ, phân quyền và kiểm soát trạng thái đăng nhập.
          </p>
        </div>

        {isAdmin ? (
          <Button type="button" onClick={() => openPanel({ type: "create" })}>
            <Plus className="size-4" />
            Tạo tài khoản
          </Button>
        ) : null}
      </section>

      {actionMessage ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 motion-toast"
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
                  <UserCheck className="size-5 text-teal-800" />
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
        <Card className="min-w-0 shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Danh sách tài khoản</CardTitle>
            <CardDescription>
              ADMIN quản lý tài khoản; ADMIN và IT_STAFF có thể khóa hoặc mở
              khóa theo phạm vi được cấp.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Phòng ban</TableHead>
                    <TableHead>Tổ chức</TableHead>
                    <TableHead>Bảo mật</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className="motion-row"
                      style={{ "--motion-index": index } as CSSProperties}
                    >
                      <TableCell>
                        <p className="font-medium">{user.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {userRoleLabels[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.department?.name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.isActive
                              ? "border-teal-200 bg-teal-50 text-teal-700"
                              : "border-slate-200 bg-slate-100 text-slate-700"
                          }
                        >
                          {user.isActive ? "Đang làm việc" : "Đã nghỉ việc"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.isLocked
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-teal-200 bg-teal-50 text-teal-700"
                          }
                        >
                          {user.isLocked ? "Tạm khóa" : "Bình thường"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {isAdmin ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() =>
                                  openPanel({ type: "edit", user })
                                }
                              >
                                <Pencil className="size-3.5" />
                                Sửa
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() =>
                                  openPanel({ type: "reset", user })
                                }
                              >
                                <KeyRound className="size-3.5" />
                                Mật khẩu
                              </Button>
                              <Button
                                type="button"
                                variant={user.isActive ? "outline" : "default"}
                                size="xs"
                                title={
                                  user.id === me.id
                                    ? "Không thể vô hiệu hóa tài khoản đang đăng nhập"
                                    : undefined
                                }
                                disabled={user.id === me.id}
                                onClick={() =>
                                  openPanel({ type: "activation", user })
                                }
                              >
                                {user.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                              </Button>
                            </>
                          ) : null}
                          <Button
                            type="button"
                            variant={user.isLocked ? "outline" : "destructive"}
                            size="xs"
                            title={
                              user.id === me.id
                                ? "Không thể khóa hoặc mở khóa tài khoản đang đăng nhập"
                                : user.role === "ADMIN"
                                  ? "Không thể khóa hoặc mở khóa tài khoản ADMIN"
                                  : undefined
                            }
                            disabled={
                              user.id === me.id || user.role === "ADMIN"
                            }
                            onClick={() => openPanel({ type: "lock", user })}
                          >
                            {user.isLocked ? (
                              <LockOpen className="size-3.5" />
                            ) : (
                              <Lock className="size-3.5" />
                            )}
                            {user.isLocked ? "Mở khóa" : "Khóa"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="grid min-h-52 place-items-center text-center">
                <div>
                  <p className="font-medium">Chưa có tài khoản</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dùng nút Tạo tài khoản để cấp quyền truy cập cho nhân viên.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {panel ? (
          <Card className="shadow-sm xl:sticky xl:top-6">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                {panel.type === "create"
                  ? "Tạo tài khoản"
                  : panel.type === "edit"
                    ? "Chỉnh sửa người dùng"
                    : panel.type === "reset"
                      ? "Đặt lại mật khẩu"
                      : panel.type === "activation"
                        ? panel.user.isActive
                          ? "Vô hiệu hóa nhân viên"
                          : "Kích hoạt lại nhân viên"
                        : panel.user.isLocked
                          ? "Mở khóa tài khoản"
                          : "Khóa tài khoản"}
                {panel.type === "create" || panel.type === "reset" ? (
                  <MailCheck className="size-4 text-teal-700" />
                ) : null}
              </CardTitle>
              <CardDescription>
                {panel.type === "create"
                  ? "ADMIN cấp thông tin đăng nhập ban đầu. Email thông báo tài khoản được gửi nếu tính năng email đang bật."
                  : panel.type === "edit"
                    ? `Cập nhật thông tin của ${panel.user.email}.`
                    : panel.type === "reset"
                      ? `Thiết lập mật khẩu mới cho ${panel.user.email}. Email thông báo được gửi nếu tính năng email đang bật.`
                      : panel.type === "activation"
                        ? `Xác nhận thay đổi trạng thái thuộc tổ chức của ${panel.user.email}.`
                        : `Xác nhận thay đổi trạng thái khóa bảo mật của ${panel.user.email}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {panel.type === "create" ? (
                <UserForm
                  key="create-user"
                  mode="create"
                  departments={departments}
                  isLoadingDepartments={departmentsQuery.isLoading}
                  isSubmitting={isSavingUser}
                  error={actionError ?? departmentError}
                  onCancel={closePanel}
                  onSubmit={handleCreate}
                />
              ) : null}

              {panel.type === "edit" ? (
                <UserForm
                  key={`edit-user-${panel.user.id}`}
                  mode="edit"
                  departments={departments}
                  defaultValues={{
                    name: panel.user.name,
                    email: panel.user.email,
                    role: panel.user.role,
                    departmentId: String(
                      panel.user.departmentId ??
                        panel.user.department?.id ??
                        "",
                    ),
                  }}
                  isLoadingDepartments={departmentsQuery.isLoading}
                  isSubmitting={isSavingUser}
                  error={actionError ?? departmentError}
                  onCancel={closePanel}
                  onSubmit={handleUpdate}
                />
              ) : null}

              {panel.type === "reset" ? (
                <ResetPasswordForm
                  key={`reset-user-${panel.user.id}`}
                  isSubmitting={resetUserPassword.isPending}
                  error={actionError}
                  onCancel={closePanel}
                  onSubmit={handleResetPassword}
                />
              ) : null}

              {panel.type === "activation" || panel.type === "lock" ? (
                <div className="grid gap-5">
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="font-medium">{panel.user.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {panel.user.email}
                    </p>
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">
                    {panel.type === "activation"
                      ? panel.user.isActive
                        ? "Nhân viên nghỉ việc hoặc không còn thuộc tổ chức. Tài khoản sẽ bị vô hiệu hóa lâu dài và mọi phiên hiện tại bị thu hồi."
                        : "Nhân viên sẽ được kích hoạt lại trong tổ chức. Trạng thái khóa bảo mật vẫn được giữ nguyên."
                      : panel.user.isLocked
                        ? "Khóa bảo mật tạm thời sẽ được gỡ. Tài khoản chỉ đăng nhập được nếu nhân viên vẫn đang hoạt động."
                        : "Tài khoản sẽ bị khóa tạm thời để xử lý rủi ro bảo mật và mọi phiên hiện tại sẽ bị thu hồi."}
                  </p>

                  {actionError ? (
                    <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
                      {actionError}
                    </div>
                  ) : null}

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closePanel}
                      disabled={
                        panel.type === "activation"
                          ? changeUserStatus.isPending
                          : changeAccountLock.isPending
                      }
                    >
                      Hủy
                    </Button>
                    <Button
                      type="button"
                      variant={
                        panel.type === "activation"
                          ? panel.user.isActive
                            ? "destructive"
                            : "default"
                          : panel.user.isLocked
                            ? "default"
                            : "destructive"
                      }
                      onClick={
                        panel.type === "activation"
                          ? handleChangeActivationStatus
                          : handleChangeAccountLock
                      }
                      disabled={
                        panel.type === "activation"
                          ? changeUserStatus.isPending
                          : changeAccountLock.isPending
                      }
                    >
                      {panel.type === "activation" ? (
                        <UserCheck className="size-4" />
                      ) : panel.user.isLocked ? (
                        <LockOpen className="size-4" />
                      ) : (
                        <Lock className="size-4" />
                      )}
                      {(
                        panel.type === "activation"
                          ? changeUserStatus.isPending
                          : changeAccountLock.isPending
                      )
                        ? "Đang cập nhật..."
                        : panel.type === "activation"
                          ? panel.user.isActive
                            ? "Xác nhận vô hiệu hóa"
                            : "Xác nhận kích hoạt"
                          : panel.user.isLocked
                            ? "Xác nhận mở khóa"
                            : "Xác nhận khóa"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
