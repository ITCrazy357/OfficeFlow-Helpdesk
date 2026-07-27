"use client";

import { AlertCircle, ArrowLeft, Boxes, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AssetForm } from "@/features/assets/components/asset-form";
import { AssetToast } from "@/features/assets/components/asset-toast";
import { useAsset, useUpdateAsset } from "@/features/assets/hooks";
import {
  toAssetPayload,
  type AssetFormValues,
} from "@/features/assets/schemas";
import { useMe } from "@/features/auth/hooks";
import { getApiErrorMessage } from "@/lib/axios";

type Feedback = {
  message: string;
  tone: "success" | "error";
};

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function EditAssetSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-8 w-64 rounded-lg bg-muted motion-shimmer" />
      <div className="h-[620px] rounded-lg bg-muted motion-shimmer" />
    </div>
  );
}

export default function EditAssetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assetId = Number(params.id);
  const validAssetId = Number.isInteger(assetId) && assetId > 0;
  const { data: user } = useMe();
  const canManage = user?.role === "ADMIN" || user?.role === "IT_STAFF";
  const assetQuery = useAsset(assetId, validAssetId && Boolean(canManage));
  const updateAsset = useUpdateAsset();
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleSubmit(values: AssetFormValues) {
    setFormError(null);
    setFeedback(null);

    try {
      await updateAsset.mutateAsync({
        id: assetId,
        input: toAssetPayload(values),
      });
      setFeedback({
        message: "Đã cập nhật thông tin tài sản.",
        tone: "success",
      });
      window.setTimeout(() => router.push(`/assets/${assetId}`), 500);
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Không thể cập nhật tài sản. Vui lòng thử lại.",
      );
      setFormError(message);
      setFeedback({ message, tone: "error" });
    }
  }

  if (!validAssetId) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-panel">
        <CardContent className="pt-0">
          <CardTitle>ID tài sản không hợp lệ</CardTitle>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/assets">Quay lại danh sách</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (user && !canManage) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-panel">
        <CardContent className="flex items-start gap-3 pt-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <CardTitle>Bạn không có quyền chỉnh sửa tài sản</CardTitle>
            <CardDescription className="mt-1">
              Chức năng này chỉ dành cho ADMIN và IT_STAFF.
            </CardDescription>
            <Button asChild variant="outline" className="mt-4">
              <Link href={`/assets/${assetId}`}>Xem chi tiết</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (assetQuery.isLoading || !user) {
    return <EditAssetSkeleton />;
  }

  if (assetQuery.isError || !assetQuery.data) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-panel">
        <CardContent className="flex items-start gap-3 pt-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </span>
          <div>
            <CardTitle>Không thể tải tài sản</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(assetQuery.error)}
            </CardDescription>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => assetQuery.refetch()}
            >
              Thử lại
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const asset = assetQuery.data;

  return (
    <div className="grid gap-6 motion-enter">
      <AssetToast
        message={feedback?.message ?? null}
        tone={feedback?.tone}
        onClose={() => setFeedback(null)}
      />

      <div>
        <Button asChild variant="ghost" className="-ml-2 mb-2">
          <Link href={`/assets/${asset.id}`}>
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
        </Button>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-800">
          <Boxes className="size-4" />
          {asset.assetTag}
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">
          Chỉnh sửa tài sản
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cập nhật thông tin định danh, mua sắm và bảo hành.
        </p>
      </div>

      <Card className="shadow-sm motion-panel">
        <CardHeader className="border-b">
          <CardTitle>{asset.name}</CardTitle>
          <CardDescription>
            Việc thay đổi mã hoặc serial vẫn phải đảm bảo tính duy nhất.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AssetForm
            key={asset.id}
            defaultValues={{
              assetTag: asset.assetTag,
              name: asset.name,
              type: asset.type,
              brand: asset.brand ?? "",
              model: asset.model ?? "",
              serialNumber: asset.serialNumber ?? "",
              purchaseDate: toDateInputValue(asset.purchaseDate),
              warrantyUntil: toDateInputValue(asset.warrantyUntil),
              notes: asset.notes ?? "",
            }}
            submitLabel="Lưu thay đổi"
            isSubmitting={updateAsset.isPending}
            error={formError}
            onCancel={() => router.push(`/assets/${asset.id}`)}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
