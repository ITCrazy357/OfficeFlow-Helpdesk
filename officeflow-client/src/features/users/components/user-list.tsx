"use client";
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
import type { AuthUser } from "@/features/auth/types";
import { userRoleLabels } from "@/features/users/constants";
import { isLastUsableAdmin } from "@/features/users/lifecycle";
import type { UserListItem } from "@/features/users/types";
import { KeyRound, Lock, LockOpen, Pencil } from "lucide-react";
import type { CSSProperties } from "react";
import type { UserPanel } from "../user-panel";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
  }).format(date);
}
type Props = {
  users: UserListItem[];
  isActionPending: boolean;
  isAdmin: boolean;
  openPanel: (panel: NonNullable<UserPanel>) => void;
  me: AuthUser;
};
export function UserList({
  users,
  isActionPending,
  isAdmin,
  openPanel,
  me,
}: Props) {
  return (
    <Card className="min-w-0 shadow-sm">
      <CardHeader className="border-b">
        <CardTitle>Danh sách tài khoản</CardTitle>
        <CardDescription>
          ADMIN quản lý tài khoản; ADMIN và IT_STAFF có thể khóa hoặc mở khóa
          theo phạm vi được cấp.
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
                    <Badge variant="outline">{userRoleLabels[user.role]}</Badge>
                  </TableCell>
                  <TableCell>{user.department?.name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.isActive
                          ? "border-teal-200 dark:border-teal-400/25 bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-200"
                          : "border-slate-200 dark:border-slate-400/25 bg-slate-100 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200"
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
                          ? "border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-200"
                          : "border-teal-200 dark:border-teal-400/25 bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-200"
                      }
                    >
                      {user.isLocked ? "Tạm khóa" : "Bình thường"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    <fieldset
                      disabled={isActionPending}
                      className="flex flex-wrap justify-end gap-1"
                    >
                      {isAdmin ? (
                        <>
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
                            onClick={() => openPanel({ type: "handoff", user })}
                          >
                            Bàn giao
                          </Button>
                          <Button
                            type="button"
                            variant={user.isActive ? "outline" : "default"}
                            size="xs"
                            title={
                              user.id === me.id
                                ? "Không thể vô hiệu hóa tài khoản đang đăng nhập"
                                : isLastUsableAdmin(user, users)
                                  ? "Phải giữ ít nhất một ADMIN có thể sử dụng"
                                  : undefined
                            }
                            disabled={
                              user.id === me.id ||
                              isLastUsableAdmin(user, users)
                            }
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
                        variant="ghost"
                        size="xs"
                        title={
                          user.id === me.id
                            ? "Hãy dùng chức năng đổi mật khẩu cá nhân"
                            : user.role === "ADMIN"
                              ? "Không thể reset mật khẩu tài khoản ADMIN"
                              : undefined
                        }
                        disabled={user.id === me.id || user.role === "ADMIN"}
                        onClick={() => openPanel({ type: "reset", user })}
                      >
                        <KeyRound className="size-3.5" />
                        Mật khẩu
                      </Button>
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
                        disabled={user.id === me.id || user.role === "ADMIN"}
                        onClick={() => openPanel({ type: "lock", user })}
                      >
                        {user.isLocked ? (
                          <LockOpen className="size-3.5" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                        {user.isLocked ? "Mở khóa" : "Khóa"}
                      </Button>
                    </fieldset>
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
  );
}
