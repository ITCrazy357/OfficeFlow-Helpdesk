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
import { formatAssetDate } from "@/features/assets/constants";
import { useAssetAssignmentHistory } from "@/features/assets/hooks";
import type { AssetAssignment } from "@/features/assets/types";
import { getApiErrorMessage } from "@/lib/axios";
import { History, UserRound } from "lucide-react";
import type { CSSProperties } from "react";

type Props = {
  historyQuery: ReturnType<typeof useAssetAssignmentHistory>;
  assignments: AssetAssignment[];
};
export function AssetAssignmentHistory({ historyQuery, assignments }: Props) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>Lịch sử cấp phát</CardTitle>
            <CardDescription>
              Người nhận, người cấp, ngày gán và ngày thu hồi.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {historyQuery.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 rounded-lg bg-muted motion-shimmer"
              />
            ))}
          </div>
        ) : historyQuery.isError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              Không thể tải lịch sử cấp phát.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {getApiErrorMessage(historyQuery.error)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => historyQuery.refetch()}
            >
              Thử lại
            </Button>
          </div>
        ) : assignments.length ? (
          <div className="grid gap-3">
            {assignments.map((assignment, index) => (
              <div
                key={assignment.id}
                className="motion-row rounded-lg border bg-muted/20 p-4"
                style={{ "--motion-index": index } as CSSProperties}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-200">
                      <UserRound className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {assignment.assignedTo.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cấp bởi {assignment.assignedBy.name}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      assignment.returnedAt
                        ? "border-slate-200 dark:border-slate-400/25 bg-slate-50 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200"
                        : "border-sky-200 dark:border-sky-400/25 bg-sky-50 dark:bg-sky-400/10 text-sky-800 dark:text-sky-200"
                    }
                  >
                    {assignment.returnedAt ? "Đã thu hồi" : "Đang sử dụng"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>
                    Ngày gán: {formatAssetDate(assignment.assignedAt, true)}
                  </p>
                  <p>
                    Ngày trả: {formatAssetDate(assignment.returnedAt, true)}
                  </p>
                </div>
                {assignment.returnNotes ? (
                  <p className="mt-3 rounded-lg bg-card px-3 py-2 text-sm leading-6">
                    {assignment.returnNotes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-5 text-center">
            <History className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">
              Chưa có lịch sử cấp phát
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
