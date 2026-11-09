"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MailCheck, RotateCcw } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

type Props = {
  returnNotes: string;
  setReturnNotes: Dispatch<SetStateAction<string>>;
  isReturning: boolean;
  handleReturn: () => Promise<void>;
};
export function AssetReturnPanel({
  returnNotes,
  setReturnNotes,
  isReturning,
  handleReturn,
}: Props) {
  return (
    <Card className="border-amber-200 dark:border-amber-400/25 bg-amber-50/40 dark:bg-amber-400/10 shadow-sm motion-panel">
      <CardHeader className="border-b border-amber-200 dark:border-amber-400/25">
        <CardTitle>Thu hồi tài sản</CardTitle>
        <CardDescription>
          Ghi chú tình trạng khi nhận lại nếu cần.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0">
        <div className="grid min-w-0 content-start gap-2">
          <Label htmlFor="return-notes">Ghi chú trả tài sản</Label>
          <Textarea
            id="return-notes"
            value={returnNotes}
            onChange={(event) => setReturnNotes(event.target.value)}
            placeholder="Ví dụ: Đã nhận đủ sạc, máy hoạt động tốt"
            maxLength={1000}
            disabled={isReturning}
          />
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-400/25 bg-card p-3 text-xs leading-5 text-amber-950 dark:text-amber-200">
          <MailCheck className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Người đang sử dụng sẽ được gửi email xác nhận thu hồi nếu tính năng
            email đang bật.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-amber-300 dark:border-amber-400/25 bg-card text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-400/10"
          onClick={handleReturn}
          disabled={isReturning}
        >
          {isReturning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
          {isReturning ? "Đang thu hồi..." : "Xác nhận thu hồi"}
        </Button>
      </CardContent>
    </Card>
  );
}
