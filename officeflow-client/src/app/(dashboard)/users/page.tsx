"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import {
  AlertCircle,
  KeyRound,
  Lock,
  LockOpen,
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
import { useMe } from "@/features/auth/hooks";
import { useDepartments } from "@/features/departments/hooks";
import { ResetPasswordForm } from "@/features/users/components/reset-password-form";
import { UserForm } from "@/features/users/components/user-form";
import { userRoleLabels } from "@/features/users/constants";
import {
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
  | { type: "status"; user: UserListItem }
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
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN";
  const usersQuery = useUsers(isAdmin);
  const departmentsQuery = useDepartments(isAdmin);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
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
      setActionMessage(`Đã tạo tài khoản ${values.email}.`);
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
      setPanel(null);
      setActionMessage(`Đã đặt lại mật khẩu cho ${panel.user.email}.`);
    } catch (error) {
      setActionError(getApiErrorMessage(error, "Không thể đặt lại mật khẩu."));
    }
  };

  const handleChangeStatus = async () => {
    if (!panel || panel.type !== "status") {
      return;
    }

    const nextStatus = !panel.user.isActive;
    setActionError(null);

    try {
      await changeUserStatus.mutateAsync({
        id: panel.user.id,
        input: {
          isActive: nextStatus,
        },
      });
      setPanel(null);
      setActionMessage(
        nextStatus
          ? `Đã mở khóa tài khoản ${panel.user.email}.`
          : `Đã khóa tài khoản ${panel.user.email}.`,
      );
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "Không thể thay đổi trạng thái tài khoản."),
      );
    }
  };

  if (me && !isAdmin) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-enter">
        <CardContent className="flex items-start gap-3 pt-0">
          <div className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <Shield className="size-5" />
          </div>
          <div>
            <CardTitle>Không có quyền truy cập</CardTitle>
            <CardDescription className="mt-1">
              Chỉ ADMIN có quyền quản lý tài khoản người dùng.
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
  const activeCount = users.filter((user) => user.isActive).length;
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

        <Button type="button" onClick={() => openPanel({ type: "create" })}>
          <Plus className="size-4" />
          Tạo tài khoản
        </Button>
      </section>

      {actionMessage ? (
        <div
          role="status"
          className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 motion-toast"
        >
          {actionMessage}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Tổng tài khoản", users.length],
          ["Đang hoạt động", activeCount],
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
              Chỉ ADMIN có thể tạo, chỉnh sửa, khóa hoặc đặt lại mật khẩu.
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
                    <TableHead>Trạng thái</TableHead>
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
                              : "border-red-200 bg-red-50 text-red-700"
                          }
                        >
                          {user.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => openPanel({ type: "edit", user })}
                          >
                            <Pencil className="size-3.5" />
                            Sửa
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => openPanel({ type: "reset", user })}
                          >
                            <KeyRound className="size-3.5" />
                            Mật khẩu
                          </Button>
                          <Button
                            type="button"
                            variant={user.isActive ? "destructive" : "outline"}
                            size="xs"
                            title={
                              user.id === me.id
                                ? "Không thể khóa tài khoản đang đăng nhập"
                                : undefined
                            }
                            disabled={user.id === me.id && user.isActive}
                            onClick={() => openPanel({ type: "status", user })}
                          >
                            {user.isActive ? (
                              <Lock className="size-3.5" />
                            ) : (
                              <LockOpen className="size-3.5" />
                            )}
                            {user.isActive ? "Khóa" : "Mở khóa"}
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
              <CardTitle>
                {panel.type === "create"
                  ? "Tạo tài khoản"
                  : panel.type === "edit"
                    ? "Chỉnh sửa người dùng"
                    : panel.type === "reset"
                      ? "Đặt lại mật khẩu"
                      : panel.user.isActive
                        ? "Khóa tài khoản"
                        : "Mở khóa tài khoản"}
              </CardTitle>
              <CardDescription>
                {panel.type === "create"
                  ? "ADMIN cấp thông tin đăng nhập ban đầu cho người dùng."
                  : panel.type === "edit"
                    ? `Cập nhật thông tin của ${panel.user.email}.`
                    : panel.type === "reset"
                      ? `Thiết lập mật khẩu mới cho ${panel.user.email}.`
                      : `Xác nhận thay đổi trạng thái của ${panel.user.email}.`}
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

              {panel.type === "status" ? (
                <div className="grid gap-5">
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="font-medium">{panel.user.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {panel.user.email}
                    </p>
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">
                    {panel.user.isActive
                      ? "Tài khoản sẽ không thể đăng nhập và mọi phiên hiện tại sẽ bị thu hồi."
                      : "Tài khoản sẽ được phép đăng nhập lại bằng mật khẩu hiện có."}
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
                      disabled={changeUserStatus.isPending}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="button"
                      variant={panel.user.isActive ? "destructive" : "default"}
                      onClick={handleChangeStatus}
                      disabled={changeUserStatus.isPending}
                    >
                      {panel.user.isActive ? (
                        <Lock className="size-4" />
                      ) : (
                        <LockOpen className="size-4" />
                      )}
                      {changeUserStatus.isPending
                        ? "Đang cập nhật..."
                        : panel.user.isActive
                          ? "Xác nhận khóa"
                          : "Xác nhận mở khóa"}
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
