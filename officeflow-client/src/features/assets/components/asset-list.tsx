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
import { OfficeFlowFigure } from "@/components/ui/officeflow-figure";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AssetStatusBadge,
  AssetTypeBadge,
} from "@/features/assets/components/asset-badges";
import {
  formatAssetDate,
  getAssetModelLabel,
} from "@/features/assets/constants";
import type { Asset } from "@/features/assets/types";
import { getApiErrorMessage } from "@/lib/axios";
import type { Pagination } from "@/types/api";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Plus,
  RotateCcw,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, Dispatch, SetStateAction } from "react";

function AssetListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="h-16 rounded-lg bg-muted motion-shimmer" />
      ))}
    </div>
  );
}
function AssetMobileCard({ asset, index }: { asset: Asset; index: number }) {
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
        <Badge variant="outline">{asset._count?.tickets ?? 0} ticket</Badge>
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
type Props = {
  pagination: Pagination | undefined;
  isLoading: boolean;
  isError: boolean;
  queryError: Error | null;
  refetchAssets: () => void;
  assets: Asset[];
  hasFilters: boolean;
  allowManagement: boolean;
  resetFilters: () => void;
  setPage: Dispatch<SetStateAction<number>>;
  page: number;
};
export function AssetList({
  pagination,
  isLoading,
  isError,
  queryError,
  refetchAssets,
  assets,
  hasFilters,
  allowManagement,
  resetFilters,
  setPage,
  page,
}: Props) {
  return (
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
          <div className="grid size-10 place-items-center rounded-lg bg-teal-950/5 dark:bg-teal-200/10 text-teal-950 dark:text-teal-200">
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
                <AssetMobileCard key={asset.id} asset={asset} index={index} />
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
              <OfficeFlowFigure kind="cabinet" className="mx-auto w-36" />
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

        {!isLoading && !isError && pagination && pagination.totalPages > 1 ? (
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
                  setPage((value) => Math.min(pagination.totalPages, value + 1))
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
  );
}
