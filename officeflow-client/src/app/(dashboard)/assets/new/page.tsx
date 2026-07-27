"use client";

import { ArrowLeft, Boxes, CircleCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useCreateAsset } from "@/features/assets/hooks";
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

export default function NewAssetPage() {
  const router = useRouter();
  const { data: user } = useMe();
  const createAsset = useCreateAsset();
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const canManage = user?.role === "ADMIN" || user?.role === "IT_STAFF";

  async function handleSubmit(values: AssetFormValues) {
    setFormError(null);
    setFeedback(null);

    try {
      const asset = await createAsset.mutateAsync(toAssetPayload(values));
      setFeedback({
        message: `Đã tạo tài sản ${asset.assetTag}.`,
        tone: "success",
      });
      window.setTimeout(() => router.push(`/assets/${asset.id}`), 500);
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Không thể tạo tài sản. Vui lòng thử lại.",
      );
      setFormError(message);
      setFeedback({ message, tone: "error" });
    }
  }

  if (user && !canManage) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-panel">
        <CardContent className="flex items-start gap-3 pt-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <CardTitle>Bạn không có quyền thêm tài sản</CardTitle>
            <CardDescription className="mt-1">
              Chức năng này chỉ dành cho ADMIN và IT_STAFF.
            </CardDescription>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/assets">Quay lại danh sách</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 motion-enter">
      <AssetToast
        message={feedback?.message ?? null}
        tone={feedback?.tone}
        onClose={() => setFeedback(null)}
      />

      <div>
        <Button asChild variant="ghost" className="-ml-2 mb-2">
          <Link href="/assets">
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
        </Button>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-800">
          <Boxes className="size-4" />
          Asset Management
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">
          Thêm tài sản mới
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ghi nhận thiết bị vào kho để theo dõi cấp phát và hỗ trợ.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="shadow-sm motion-panel">
          <CardHeader className="border-b">
            <CardTitle>Thông tin tài sản</CardTitle>
            <CardDescription>
              Mã tài sản và số serial phải duy nhất trong hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <AssetForm
              submitLabel="Tạo tài sản"
              isSubmitting={createAsset.isPending}
              error={formError}
              onCancel={() => router.push("/assets")}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>

        <aside className="grid content-start gap-4">
          <Card className="shadow-sm motion-panel">
            <CardContent className="grid gap-4 pt-0">
              <div className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CircleCheck className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    Trạng thái khởi tạo
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Tài sản mới sẽ ở trạng thái Sẵn sàng.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700">
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Dữ liệu cần kiểm tra</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Xác nhận mã, serial và thời hạn bảo hành trước khi lưu.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
