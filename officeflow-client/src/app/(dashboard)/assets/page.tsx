"use client";

import type { CSSProperties } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  PackageOpen,
  Plus,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAssets, useMyAssets } from "@/features/assets/hooks";
import {
  assetStatusOptions,
  assetTypeOptions,
  formatAssetDate,
  getAssetModelLabel,
} from "@/features/assets/constants";
import {
  AssetStatusBadge,
  AssetTypeBadge,
} from "@/features/assets/components/asset-badges";
import type {
  Asset,
  AssetStatus,
  AssetType,
} from "@/features/assets/types";
import { useMe } from "@/features/auth/hooks";
import { useUsers } from "@/features/users/hooks";
import { getApiErrorMessage } from "@/lib/axios";

const PAGE_SIZE = 10;

function canManageAssets(role?: string) {
  return role === "ADMIN" || role === "IT_STAFF";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesAssetSearch(asset: Asset, keyword: string) {
  if (!keyword) {
    return true;
  }

  return normalizeSearch(
    [
      asset.assetTag,
      asset.name,
      asset.brand,
      asset.model,
      asset.serialNumber,
    ]
      .filter(Boolean)
      .join(" "),
  ).includes(keyword);
}

function AssetListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="h-16 rounded-lg bg-muted motion-shimmer"
        />
      ))}
    </div>
  );
}

function AssetMobileCard({
  asset,
  index,
}: {
  asset: Asset;
  index: number;
}) {
  return (
    <Link
      href={`/assets/${asset.id}`}
      className="motion-card rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50/25 md:hidden"
      style={{ "--motion-index": index } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{asset.name}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {asset.assetTag}
          </p>
        </div>
        <AssetStatusBadge status={asset.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <AssetTypeBadge type={asset.type} />
        <Badge variant="outline">
          {asset._count?.tickets ?? 0} ticket
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Model</span>
          <span className="truncate font-medium">
            {getAssetModelLabel(asset)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Người sử dụng</span>
          <span className="truncate font-medium">
            {asset.assignedTo?.name ?? "Chưa gán"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function AssetsPage() {
  const { data: user } = useMe();
  const allowManagement = canManageAssets(user?.role);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<AssetType | "ALL">("ALL");
  const [status, setStatus] = useState<AssetStatus | "ALL">("ALL");
  const [assignedToId, setAssignedToId] = useState<string>("ALL");
  const deferredKeyword = useDeferredValue(keyword.trim());
  const normalizedKeyword = normalizeSearch(deferredKeyword);

  const assetsQuery = useAssets(
    {
      page,
      limit: PAGE_SIZE,
      keyword: deferredKeyword || undefined,
      type: type === "ALL" ? undefined : type,
      status: status === "ALL" ? undefined : status,
      assignedToId:
        assignedToId === "ALL" ? undefined : Number(assignedToId),
    },
    Boolean(user && allowManagement),
  );
  const myAssetsQuery = useMyAssets(Boolean(user && !allowManagement));
  const usersQuery = useUsers(Boolean(user && allowManagement));

  const filteredMyAssets = useMemo(() => {
    return (myAssetsQuery.data ?? []).filter(
      (asset) =>
        matchesAssetSearch(asset, normalizedKeyword) &&
        (type === "ALL" || asset.type === type) &&
        (status === "ALL" || asset.status === status),
    );
  }, [myAssetsQuery.data, normalizedKeyword, status, type]);

  const myTotalPages = Math.max(
    1,
    Math.ceil(filteredMyAssets.length / PAGE_SIZE),
  );
  const myAssets = filteredMyAssets.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const assets = allowManagement
    ? (assetsQuery.data?.items ?? [])
    : myAssets;
  const pagination = allowManagement
    ? assetsQuery.data?.pagination
    : {
        page,
        limit: PAGE_SIZE,
        totalItems: filteredMyAssets.length,
        totalPages: myTotalPages,
      };
  const activeUsers = (usersQuery.data ?? []).filter(
    (item) => item.isActive,
  );
  const isLoading = !user
    ? true
    : allowManagement
      ? assetsQuery.isLoading
      : myAssetsQuery.isLoading;
  const isError = allowManagement
    ? assetsQuery.isError
    : myAssetsQuery.isError;
  const queryError = allowManagement
    ? assetsQuery.error
    : myAssetsQuery.error;
  const hasFilters =
    keyword.trim().length > 0 ||
    type !== "ALL" ||
    status !== "ALL" ||
    assignedToId !== "ALL";

  function resetFilters() {
    setKeyword("");
    setType("ALL");
    setStatus("ALL");
    setAssignedToId("ALL");
    setPage(1);
  }

  function refetchAssets() {
    if (allowManagement) {
      assetsQuery.refetch();
      return;
    }

    myAssetsQuery.refetch();
  }

  return (
    <div className="grid gap-6 motion-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-800">
            <Boxes className="size-4" />
            Asset Management
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            {allowManagement ? "Quản lý tài sản" : "Tài sản của tôi"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {allowManagement
              ? "Theo dõi trạng thái, người sử dụng và các ticket liên quan đến thiết bị."
              : "Xem các thiết bị hiện được cấp cho bạn và lịch sử hỗ trợ liên quan."}
          </p>
        </div>
        {allowManagement ? (
          <Button asChild>
            <Link href="/assets/new">
              <Plus className="size-4" />
              Thêm tài sản
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="shadow-sm motion-panel">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Bộ lọc tài sản</CardTitle>
              <CardDescription className="mt-1">
                Tìm theo mã, tên, thương hiệu, model hoặc số serial.
              </CardDescription>
            </div>
            {hasFilters ? (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                <RotateCcw className="size-4" />
                Đặt lại
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              className="pl-9"
              placeholder="Tìm tài sản..."
              aria-label="Tìm tài sản"
            />
          </div>
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value as AssetType | "ALL");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Loại tài sản" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả loại</SelectItem>
              {assetTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as AssetStatus | "ALL");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              {assetStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {allowManagement ? (
            <Select
              value={assignedToId}
              onValueChange={(value) => {
                setAssignedToId(value);
                setPage(1);
              }}
              disabled={usersQuery.isLoading || usersQuery.isError}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Người sử dụng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả người dùng</SelectItem>
                {activeUsers.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name} / {item.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm motion-panel">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Danh sách tài sản</CardTitle>
              <CardDescription className="mt-1">
                {pagination
                  ? `${pagination.totalItems.toLocaleString("vi-VN")} tài sản`
                  : "Đang tải dữ liệu"}
              </CardDescription>
            </div>
            <div className="grid size-10 place-items-center rounded-lg bg-teal-950/5 text-teal-950">
              <Boxes className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <AssetListSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-start gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-destructive">
                    Không thể tải danh sách tài sản
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getApiErrorMessage(queryError)}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={refetchAssets}>
                Thử lại
              </Button>
            </div>
          ) : assets.length ? (
            <>
              <div className="grid gap-3 md:hidden">
                {assets.map((asset, index) => (
                  <AssetMobileCard
                    key={asset.id}
                    asset={asset}
                    index={index}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tài sản</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Người sử dụng</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Cập nhật</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset, index) => (
                      <TableRow
                        key={asset.id}
                        className="motion-row"
                        style={{ "--motion-index": index } as CSSProperties}
                      >
                        <TableCell>
                          <Link
                            href={`/assets/${asset.id}`}
                            className="group block min-w-44"
                          >
                            <span className="font-semibold group-hover:text-teal-800">
                              {asset.name}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {asset.assetTag}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <AssetTypeBadge type={asset.type} />
                        </TableCell>
                        <TableCell className="max-w-48 truncate">
                          {getAssetModelLabel(asset)}
                        </TableCell>
                        <TableCell>
                          <AssetStatusBadge status={asset.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-40 items-center gap-2">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                              <UserRound className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {asset.assignedTo?.name ?? "Chưa gán"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {asset.assignedTo?.department?.name ??
                                  asset.assignedTo?.email ??
                                  "Sẵn sàng cấp phát"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {asset._count?.tickets ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatAssetDate(asset.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="grid min-h-64 place-items-center rounded-lg border border-dashed p-6 text-center">
              <div>
                <PackageOpen className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">
                  {hasFilters
                    ? "Không tìm thấy tài sản phù hợp"
                    : allowManagement
                      ? "Chưa có tài sản"
                      : "Bạn chưa được gán tài sản"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  {hasFilters
                    ? "Hãy thay đổi từ khóa hoặc bộ lọc để xem kết quả khác."
                    : allowManagement
                      ? "Thêm tài sản đầu tiên để bắt đầu theo dõi cấp phát và ticket liên quan."
                      : "Tài sản được cấp sẽ tự động xuất hiện tại đây."}
                </p>
                {hasFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={resetFilters}
                  >
                    <RotateCcw className="size-4" />
                    Xóa bộ lọc
                  </Button>
                ) : allowManagement ? (
                  <Button asChild className="mt-4">
                    <Link href="/assets/new">
                      <Plus className="size-4" />
                      Thêm tài sản
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {!isLoading &&
          !isError &&
          pagination &&
          pagination.totalPages > 1 ? (
            <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {pagination.page} / {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                >
                  <ArrowLeft className="size-4" />
                  Trước
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setPage((value) =>
                      Math.min(pagination.totalPages, value + 1),
                    )
                  }
                  disabled={page >= pagination.totalPages}
                >
                  Sau
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
