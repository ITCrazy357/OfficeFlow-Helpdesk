"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  CheckCircle2,
  FolderCog,
  Pencil,
  Plus,
  Search,
  Shield,
  Tags,
  Trash2,
  X,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMe } from "@/features/auth/hooks";
import { getTicketCategoryLabel } from "@/features/ticket-categories/constants";
import {
  useCreateTicketCategory,
  useDeleteTicketCategory,
  useTicketCategories,
  useUpdateTicketCategory,
} from "@/features/ticket-categories/hooks";
import {
  ticketCategoryFormSchema,
  type TicketCategoryFormValues,
} from "@/features/ticket-categories/schemas";
import type { TicketCategory } from "@/features/ticket-categories/types";
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

function CategoriesSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-20 rounded-lg bg-muted motion-shimmer" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-96 rounded-lg bg-muted motion-shimmer" />
        <div className="h-64 rounded-lg bg-muted motion-shimmer" />
      </div>
    </div>
  );
}

export default function TicketCategoriesPage() {
  const { data: me } = useMe();
  const categoriesQuery = useTicketCategories(me?.role === "ADMIN");
  const createCategory = useCreateTicketCategory();
  const updateCategory = useUpdateTicketCategory();
  const deleteCategory = useDeleteTicketCategory();
  const [keyword, setKeyword] = useState("");
  const [editingCategory, setEditingCategory] =
    useState<TicketCategory | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<TicketCategory | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const form = useForm<TicketCategoryFormValues>({
    resolver: zodResolver(ticketCategoryFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );
  const filteredCategories = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("vi");

    if (!normalizedKeyword) {
      return categories;
    }

    return categories.filter((category) => {
      const searchableName =
        `${category.name} ${getTicketCategoryLabel(category.name)}`.toLocaleLowerCase(
          "vi",
        );

      return searchableName.includes(normalizedKeyword);
    });
  }, [categories, keyword]);

  const isSaving = createCategory.isPending || updateCategory.isPending;

  function resetForm() {
    setEditingCategory(null);
    setFormError(null);
    form.reset({ name: "" });
  }

  function startEditing(category: TicketCategory) {
    setEditingCategory(category);
    setFeedback(null);
    setFormError(null);
    form.reset({ name: category.name });
  }

  const handleSubmit: SubmitHandler<TicketCategoryFormValues> = async (
    values,
  ) => {
    setFeedback(null);
    setFormError(null);

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          input: {
            name: values.name.trim(),
          },
        });
        setFeedback("Đã cập nhật danh mục.");
      } else {
        await createCategory.mutateAsync({
          name: values.name.trim(),
        });
        setFeedback("Đã thêm danh mục mới.");
      }

      resetForm();
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "Không thể lưu danh mục. Vui lòng thử lại."),
      );
    }
  };

  async function handleDelete() {
    if (!deleteCandidate) {
      return;
    }

    setDeleteError(null);
    setFeedback(null);

    try {
      const result = await deleteCategory.mutateAsync(deleteCandidate.id);
      const detachedMessage =
        result.detachedTickets > 0
          ? ` ${result.detachedTickets} ticket đã được chuyển về chưa phân loại.`
          : "";

      if (editingCategory?.id === deleteCandidate.id) {
        resetForm();
      }

      setDeleteCandidate(null);
      setFeedback(`Đã xóa danh mục.${detachedMessage}`);
    } catch (error) {
      setDeleteError(
        getApiErrorMessage(error, "Không thể xóa danh mục. Vui lòng thử lại."),
      );
    }
  }

  if (!me) {
    return <CategoriesSkeleton />;
  }

  if (me.role !== "ADMIN") {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-enter">
        <CardContent className="flex items-start gap-3 pt-0">
          <div className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <Shield className="size-5" />
          </div>
          <div>
            <CardTitle>Không có quyền truy cập</CardTitle>
            <CardDescription className="mt-1">
              Chỉ ADMIN có quyền quản lý danh mục ticket.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (categoriesQuery.isLoading) {
    return <CategoriesSkeleton />;
  }

  if (categoriesQuery.isError) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-enter">
        <CardContent className="flex items-start gap-3 pt-0">
          <div className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </div>
          <div className="min-w-0">
            <CardTitle>Không thể tải danh mục</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(
                categoriesQuery.error,
                "Không thể tải danh mục ticket.",
              )}
            </CardDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => categoriesQuery.refetch()}
            >
              Thử lại
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 motion-enter">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <FolderCog className="size-3.5" />
            Cấu hình ticket
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Danh mục ticket
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý nhóm yêu cầu hỗ trợ dùng trong toàn hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
          <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-teal-800">
            <Tags className="size-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Tổng danh mục</p>
            <p className="text-xl font-semibold">{categories.length}</p>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 motion-toast">
          <CheckCircle2 className="size-4 shrink-0" />
          {feedback}
        </div>
      ) : null}

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="shadow-sm lg:order-2">
          <CardHeader className="border-b">
            <CardTitle>
              {editingCategory ? "Sửa danh mục" : "Thêm danh mục"}
            </CardTitle>
            <CardDescription>
              Tên mới sẽ hiển thị trong form và thông tin ticket.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit(handleSubmit)}
              noValidate
            >
              <div className="grid gap-2">
                <Label htmlFor="ticket-category-name">Tên danh mục</Label>
                <Input
                  id="ticket-category-name"
                  placeholder="Ví dụ: Thiết bị di động"
                  aria-invalid={Boolean(form.formState.errors.name)}
                  disabled={isSaving}
                  {...form.register("name")}
                />
                {form.formState.errors.name?.message ? (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              {formError ? (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
                  {formError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {editingCategory ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    disabled={isSaving}
                  >
                    <X className="size-4" />
                    Hủy sửa
                  </Button>
                ) : null}
                <Button type="submit" disabled={isSaving}>
                  {editingCategory ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {isSaving
                    ? "Đang lưu..."
                    : editingCategory
                      ? "Lưu thay đổi"
                      : "Thêm danh mục"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="min-w-0 shadow-sm lg:order-1">
          <CardHeader className="border-b">
            <CardTitle>Danh sách danh mục</CardTitle>
            <CardDescription>
              {filteredCategories.length} trên {categories.length} danh mục
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="pl-9"
                placeholder="Tìm theo tên danh mục..."
                aria-label="Tìm danh mục"
              />
            </div>

            {deleteCandidate ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 motion-panel">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-red-100 text-red-700">
                    <Trash2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-red-950">
                      Xóa “{getTicketCategoryLabel(deleteCandidate.name)}”?
                    </p>
                    <p className="mt-1 text-sm text-red-800">
                      {deleteCandidate._count.tickets > 0
                        ? `${deleteCandidate._count.tickets} ticket liên quan sẽ chuyển về chưa phân loại.`
                        : "Danh mục này chưa được ticket nào sử dụng."}
                    </p>
                  </div>
                </div>
                {deleteError ? (
                  <p className="mt-3 text-sm font-medium text-destructive">
                    {deleteError}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deleteCategory.isPending}
                    onClick={() => {
                      setDeleteCandidate(null);
                      setDeleteError(null);
                    }}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleteCategory.isPending}
                    onClick={handleDelete}
                  >
                    <Trash2 className="size-4" />
                    {deleteCategory.isPending ? "Đang xóa..." : "Xác nhận xóa"}
                  </Button>
                </div>
              </div>
            ) : null}

            {filteredCategories.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Danh mục</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((category, index) => {
                    const displayName = getTicketCategoryLabel(category.name);

                    return (
                      <TableRow
                        key={category.id}
                        className="motion-row"
                        style={{ "--motion-index": index } as CSSProperties}
                      >
                        <TableCell>
                          <p className="font-medium">{displayName}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {displayName === category.name
                              ? `#${category.id}`
                              : `${category.name} · #${category.id}`}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-teal-200 bg-teal-50 text-teal-800"
                          >
                            {category._count.tickets}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(category.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Sửa ${displayName}`}
                              title="Sửa danh mục"
                              onClick={() => startEditing(category)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Xóa ${displayName}`}
                              title="Xóa danh mục"
                              onClick={() => {
                                setDeleteCandidate(category);
                                setDeleteError(null);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="grid min-h-52 place-items-center text-center">
                <div>
                  <span className="mx-auto grid size-11 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Tags className="size-5" />
                  </span>
                  <p className="mt-3 font-medium">
                    {categories.length === 0
                      ? "Chưa có danh mục"
                      : "Không tìm thấy danh mục"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categories.length === 0
                      ? "Thêm danh mục đầu tiên để phân loại ticket."
                      : "Thử tìm bằng một từ khóa khác."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
