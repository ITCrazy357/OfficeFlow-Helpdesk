"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { careWarrantyDate } from "@/features/assets/care-utils";
import {
  formatAssetDate,
  getAssetModelLabel,
} from "@/features/assets/constants";
import type { Asset, AssetAssignment } from "@/features/assets/types";
import {
  Boxes,
  CalendarDays,
  History,
  Link2,
  UserRound,
  Wrench,
} from "lucide-react";

function DetailItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Boxes;
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-muted/20 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-950/5 dark:bg-teal-200/10 text-teal-950 dark:text-teal-200">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
type Props = {
  asset: Asset;
  assignments: AssetAssignment[];
};
export function AssetInformation({ asset, assignments }: Props) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <CardTitle>Thông tin tài sản</CardTitle>
        <CardDescription>
          Thông tin định danh, mua sắm và vòng đời thiết bị.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
        <DetailItem
          label="Thương hiệu / model"
          value={getAssetModelLabel(asset)}
          icon={Boxes}
        />
        <DetailItem
          label="Số serial"
          value={asset.serialNumber ?? "Chưa cập nhật"}
          icon={Link2}
        />
        <DetailItem
          label="Ngày mua"
          value={formatAssetDate(asset.purchaseDate)}
          icon={CalendarDays}
        />
        <DetailItem
          label="Bảo hành đến"
          value={careWarrantyDate(asset.warrantyUntil) || "Chưa ghi nhận"}
          icon={Wrench}
        />
        <DetailItem
          label="Ngày tạo"
          value={formatAssetDate(asset.createdAt, true)}
          icon={CalendarDays}
        />
        <DetailItem
          label="Nhà cung cấp"
          value={asset.supplierName || "Chưa ghi nhận"}
          icon={Wrench}
        />
        <DetailItem
          label="Liên hệ nhà cung cấp"
          value={asset.supplierContact || "Chưa ghi nhận"}
          icon={UserRound}
        />
        <DetailItem
          label="Số lần cấp phát"
          value={
            asset._count?.assignments != null
              ? String(asset._count.assignments)
              : assignments.length
                ? String(assignments.length)
                : "Chưa có dữ liệu"
          }
          icon={History}
        />
      </CardContent>
    </Card>
  );
}
