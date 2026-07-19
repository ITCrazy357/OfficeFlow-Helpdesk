"use client";

import type { CSSProperties } from "react";
import { AlertCircle, Shield, UserCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import type { UserRole } from "@/features/auth/types";
import { useUsers } from "@/features/users/hooks";
import { getApiErrorMessage } from "@/lib/axios";

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  IT_STAFF: "IT Staff",
  EMPLOYEE: "Employee",
};

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
  const usersQuery = useUsers(me?.role === "ADMIN");

  if (me && me.role !== "ADMIN") {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-enter">
        <CardContent className="flex items-start gap-3 pt-0">
          <div className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <Shield className="size-5" />
          </div>
          <div>
            <CardTitle>Không có quyền truy cập</CardTitle>
            <CardDescription className="mt-1">
              Chỉ ADMIN có quyền xem danh sách người dùng.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (usersQuery.isLoading) {
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
            <CardTitle>Không thể tải users</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(usersQuery.error, "Không thể tải users.")}
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    );
  }

  const users = usersQuery.data ?? [];
  const activeCount = users.filter((user) => user.isActive).length;
  const staffCount = users.filter(
    (user) => user.role === "ADMIN" || user.role === "IT_STAFF",
  ).length;

  return (
    <div className="grid gap-6 motion-enter">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" />
            Admin module
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Danh sách tài khoản nội bộ và trạng thái hoạt động.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Tổng users", users.length],
          ["Đang hoạt động", activeCount],
          ["Admin / IT Staff", staffCount],
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

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>Danh sách users</CardTitle>
          <CardDescription>
            Backend hiện hỗ trợ xem danh sách, chưa có API tạo/sửa/xóa user.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phòng ban</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user, index) => (
                  <TableRow
                    key={user.id}
                    className="motion-row"
                    style={{ "--motion-index": index } as CSSProperties}
                  >
                    <TableCell className="font-medium">#{user.id}</TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabels[user.role]}</Badge>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid min-h-52 place-items-center text-center">
              <div>
                <p className="font-medium">Chưa có user</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chạy seed dữ liệu hoặc đăng ký tài khoản mới để có dữ liệu.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
