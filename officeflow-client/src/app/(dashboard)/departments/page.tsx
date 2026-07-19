"use client";

import type { CSSProperties } from "react";
import { AlertCircle, Building2, Layers3 } from "lucide-react";

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
import { useDepartments } from "@/features/departments/hooks";
import { getApiErrorMessage } from "@/lib/axios";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
  }).format(date);
}

function DepartmentsSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-0">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-14 rounded-lg bg-muted motion-shimmer"
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default function DepartmentsPage() {
  const departmentsQuery = useDepartments();

  if (departmentsQuery.isLoading) {
    return <DepartmentsSkeleton />;
  }

  if (departmentsQuery.isError) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-enter">
        <CardContent className="flex items-start gap-3 pt-0">
          <div className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <CardTitle>Không thể tải departments</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(
                departmentsQuery.error,
                "Không thể tải departments.",
              )}
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    );
  }

  const departments = departmentsQuery.data ?? [];

  return (
    <div className="grid gap-6 motion-enter">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5" />
            Organization module
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Departments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Danh sách phòng ban đang được dùng trong hệ thống.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card
          className="motion-card shadow-sm"
          style={{ "--motion-index": 0 } as CSSProperties}
        >
          <CardHeader>
            <CardDescription>Tổng phòng ban</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              {departments.length}
              <Layers3 className="size-5 text-teal-800" />
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>Danh sách departments</CardTitle>
          <CardDescription>
            Backend hiện hỗ trợ xem danh sách, chưa có API tạo/sửa/xóa
            department.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {departments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tên phòng ban</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Cập nhật</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department, index) => (
                  <TableRow
                    key={department.id}
                    className="motion-row"
                    style={{ "--motion-index": index } as CSSProperties}
                  >
                    <TableCell className="font-medium">
                      #{department.id}
                    </TableCell>
                    <TableCell>{department.name}</TableCell>
                    <TableCell>{formatDate(department.createdAt)}</TableCell>
                    <TableCell>{formatDate(department.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid min-h-52 place-items-center text-center">
              <div>
                <p className="font-medium">Chưa có department</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chạy seed dữ liệu để tạo IT, HR, Finance, Marketing.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
