"use client";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssetCareOverview } from "../care-hooks";
import { careWarrantyDate } from "../care-utils";
import { getApiErrorMessage } from "@/lib/axios";

export default function AssetCareOverview() {
  const query = useAssetCareOverview();
  const data = query.data;
  if (query.isLoading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Đang tải lịch bảo trì và bảo hành…
      </p>
    );
  if (query.isError)
    return (
      <div role="alert" className="rounded-lg border p-4 text-sm">
        {getApiErrorMessage(query.error, "Không thể tải tổng quan bảo trì.")}{" "}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
        >
          Tải lại tổng quan
        </Button>
      </div>
    );
  if (!data) return null;
  return (
    <section aria-label="Tổng quan bảo trì và bảo hành" className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            "Sắp hết bảo hành",
            data.warrantySoon,
            `Trong ${data.reminderDays} ngày tới, kể cả hôm nay.`,
          ],
          [
            "Đã hết bảo hành",
            data.warrantyExpired,
            "Không tính tài sản đã thanh lý hoặc bị mất.",
          ],
          [
            "Lịch cần theo dõi",
            data.maintenanceDue,
            `Lịch chưa hoàn tất đến ${data.reminderDays} ngày tới, gồm cả quá ngày.`,
          ],
        ].map(([title, value, detail]) => (
          <Card key={title}>
            <CardContent>
              <CardDescription>{title}</CardDescription>
              <CardTitle className="mt-2 text-2xl tabular-nums">
                {value}
              </CardTitle>
              <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bảo hành sắp hết hạn</CardTitle>
            <CardDescription>
              Tối đa 5 tài sản gần hết hạn nhất. Nhắc trong ứng dụng cho
              ADMIN/IT_STAFF, một lần cho mỗi hạn bảo hành.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.warrantyAssets.length ? (
              <ul className="divide-y">
                {data.warrantyAssets.map((asset) => (
                  <li key={asset.id} className="py-2">
                    <Link
                      className="block rounded-sm text-sm hover:underline"
                      href={`/assets/${asset.id}`}
                    >
                      <span className="font-medium">
                        {asset.assetTag} · {asset.name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Đến {careWarrantyDate(asset.warrantyUntil)}
                        {asset.supplierName && ` · ${asset.supplierName}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Không có bảo hành sắp hết hạn.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lịch bảo trì gần nhất</CardTitle>
            <CardDescription>
              Tối đa 5 lịch chưa hoàn tất, ưu tiên ngày cũ nhất. Mở tài sản để
              xem đầy đủ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.maintenances.length ? (
              <ul className="divide-y">
                {data.maintenances.map((record) => (
                  <li key={record.id} className="py-2">
                    <Link
                      className="block rounded-sm text-sm hover:underline"
                      href={`/assets/${record.assetId}`}
                    >
                      <span className="font-medium">
                        {record.asset.assetTag} · {record.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {record.scheduledFor.slice(0, 10)}
                        {record.scheduledFor.slice(0, 10) < data.today
                          ? " · Quá ngày dự kiến"
                          : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Không có lịch cần theo dõi.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
