"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { manualAssetStatusOptions } from "@/features/assets/constants";
import type { Asset, ManualAssetStatus } from "@/features/assets/types";
import { Loader2, Wrench } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

type Props = {
  nextStatus: ManualAssetStatus | "";
  setNextStatus: Dispatch<SetStateAction<ManualAssetStatus | "">>;
  isChangingStatus: boolean;
  asset: Asset;
  handleChangeStatus: () => Promise<void>;
};
export function AssetStatusPanel({
  nextStatus,
  setNextStatus,
  isChangingStatus,
  asset,
  handleChangeStatus,
}: Props) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <CardTitle>Đổi trạng thái</CardTitle>
        <CardDescription>
          Chỉ có thể đổi trạng thái khi tài sản chưa được gán.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0">
        <Select
          value={nextStatus}
          onValueChange={(value) => setNextStatus(value as ManualAssetStatus)}
          disabled={isChangingStatus}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Chọn trạng thái mới" />
          </SelectTrigger>
          <SelectContent>
            {manualAssetStatusOptions
              .filter((option) => option.value !== asset.status)
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={handleChangeStatus}
          disabled={isChangingStatus || !nextStatus}
        >
          {isChangingStatus ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wrench className="size-4" />
          )}
          {isChangingStatus ? "Đang cập nhật..." : "Lưu trạng thái"}
        </Button>
      </CardContent>
    </Card>
  );
}
