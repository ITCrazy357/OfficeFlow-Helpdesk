"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AuthUser } from "@/features/auth/types";
import { useDepartments } from "@/features/departments/hooks";
import type { Department } from "@/features/departments/types";
import { ResetPasswordForm } from "@/features/users/components/reset-password-form";
import { UserForm } from "@/features/users/components/user-form";
import { UserHandoffForm } from "@/features/users/components/user-handoff-form";
import {
  useChangeAccountLock,
  useChangeUserStatus,
  useHandoffUser,
  useResetUserPassword,
} from "@/features/users/hooks";
import { isLastUsableAdmin } from "@/features/users/lifecycle";
import type {
  ResetPasswordFormValues,
  UserFormValues,
} from "@/features/users/schemas";
import type { UserListItem } from "@/features/users/types";
import { Lock, LockOpen, MailCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import type { UserPanel } from "../user-panel";

type Props = {
  panel: NonNullable<UserPanel>;
  users: UserListItem[];
  handoffUser: ReturnType<typeof useHandoffUser>;
  actionError: string | null;
  handleHandoff: (replacementId: number) => Promise<void>;
  closePanel: () => void;
  isAdmin: boolean;
  isActionPending: boolean;
  openPanel: (panel: NonNullable<UserPanel>) => void;
  departments: Department[];
  departmentsQuery: ReturnType<typeof useDepartments>;
  isSavingUser: boolean;
  departmentError: string | null;
  handleCreate: (values: UserFormValues) => Promise<void>;
  me: AuthUser;
  handleUpdate: (values: UserFormValues) => Promise<void>;
  resetUserPassword: ReturnType<typeof useResetUserPassword>;
  handleResetPassword: (values: ResetPasswordFormValues) => Promise<void>;
  changeUserStatus: ReturnType<typeof useChangeUserStatus>;
  changeAccountLock: ReturnType<typeof useChangeAccountLock>;
  handleChangeActivationStatus: () => Promise<void>;
  handleChangeAccountLock: () => Promise<void>;
};
export function UserActionPanel({
  panel,
  users,
  handoffUser,
  actionError,
  handleHandoff,
  closePanel,
  isAdmin,
  isActionPending,
  openPanel,
  departments,
  departmentsQuery,
  isSavingUser,
  departmentError,
  handleCreate,
  me,
  handleUpdate,
  resetUserPassword,
  handleResetPassword,
  changeUserStatus,
  changeAccountLock,
  handleChangeActivationStatus,
  handleChangeAccountLock,
}: Props) {
  return (
    <Card className="shadow-sm xl:sticky xl:top-6">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          {panel.type === "handoff"
            ? "Bàn giao trách nhiệm"
            : panel.type === "create"
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
            <MailCheck className="size-4 text-teal-700 dark:text-teal-200" />
          ) : null}
        </CardTitle>
        <CardDescription>
          {panel.type === "handoff"
            ? `Bàn giao nhân viên và đơn nghỉ của ${panel.user.email}.`
            : panel.type === "create"
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
        {panel.type === "handoff" ? (
          <UserHandoffForm
            key={`handoff-${panel.user.id}`}
            user={panel.user}
            users={users}
            isSubmitting={handoffUser.isPending}
            error={actionError}
            onSubmit={handleHandoff}
            onCancel={closePanel}
          />
        ) : null}
        {isAdmin &&
        (panel.type === "edit" ||
          (panel.type === "activation" && panel.user.isActive)) ? (
          <div className="mb-4 grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm leading-6">
            <p>
              Trước khi vô hiệu hóa hoặc bỏ quyền xử lý, hãy bàn giao ticket,
              tài sản, đơn nghỉ chờ duyệt và nhân viên trực thuộc. Hệ thống phải
              còn ít nhất một ADMIN hoạt động, không bị khóa.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={isActionPending}
              onClick={() => openPanel({ type: "handoff", user: panel.user })}
            >
              Bàn giao nhân viên và đơn nghỉ
            </Button>
            <p>
              <Link className="underline" href="/tickets">
                Quản lý ticket
              </Link>{" "}
              ·{" "}
              <Link className="underline" href="/assets">
                Quản lý tài sản
              </Link>
            </p>
          </div>
        ) : null}
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
            roleDisabledReason={
              panel.user.id === me.id
                ? "Không thể tự bỏ quyền ADMIN của mình."
                : isLastUsableAdmin(panel.user, users)
                  ? "Phải giữ ít nhất một ADMIN đang hoạt động và không bị khóa."
                  : undefined
            }
            mode="edit"
            departments={departments}
            defaultValues={{
              name: panel.user.name,
              email: panel.user.email,
              role: panel.user.role,
              departmentId: String(
                panel.user.departmentId ?? panel.user.department?.id ?? "",
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
  );
}
