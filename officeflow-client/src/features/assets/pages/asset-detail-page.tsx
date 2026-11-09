"use client";
import { AssetAssignmentHistory } from "@/features/assets/components/asset-assignment-history";
import { AssetAssignmentPanel } from "@/features/assets/components/asset-assignment-panel";
import { AssetInformation } from "@/features/assets/components/asset-information";
import { AssetReturnPanel } from "@/features/assets/components/asset-return-panel";
import { AssetStatusPanel } from "@/features/assets/components/asset-status-panel";

import {
  AlertCircle,
  ArrowLeft,
  Edit3,
  PackageOpen,
  TicketCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AssetStatusBadge,
  AssetTypeBadge,
} from "@/features/assets/components/asset-badges";
import AssetMaintenancePanel from "@/features/assets/components/asset-maintenance-panel";
import { AssetToast } from "@/features/assets/components/asset-toast";
import { formatAssetDate } from "@/features/assets/constants";
import {
  useAsset,
  useAssetAssignmentHistory,
  useAssignAsset,
  useChangeAssetStatus,
  useReturnAsset,
} from "@/features/assets/hooks";
import type { ManualAssetStatus } from "@/features/assets/types";
import { useMe } from "@/features/auth/hooks";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/features/tickets/components/ticket-badges";
import { useUsers } from "@/features/users/hooks";
import type { UserListItem } from "@/features/users/types";
import { getApiErrorMessage } from "@/lib/axios";

type Feedback = {
  message: string;
  tone: "success" | "error";
};

function canManageAssets(role?: string) {
  return role === "ADMIN" || role === "IT_STAFF";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesUser(user: UserListItem, keyword: string) {
  if (!keyword) {
    return true;
  }

  return normalizeSearch(
    [user.name, user.email, user.department?.name].filter(Boolean).join(" "),
  ).includes(keyword);
}

function AssetDetailSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-9 w-72 rounded-lg bg-muted motion-shimmer" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <div className="h-80 rounded-lg bg-muted motion-shimmer" />
          <div className="h-64 rounded-lg bg-muted motion-shimmer" />
        </div>
        <div className="h-96 rounded-lg bg-muted motion-shimmer" />
      </div>
    </div>
  );
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const rawAssetId = Number(params.id);
  const assetId =
    Number.isInteger(rawAssetId) && rawAssetId > 0 ? rawAssetId : 0;
  const { data: user } = useMe();
  const allowManagement = canManageAssets(user?.role);
  const assetQuery = useAsset(assetId, assetId > 0);
  const historyQuery = useAssetAssignmentHistory(
    assetId,
    assetId > 0 && allowManagement,
  );
  const usersQuery = useUsers(Boolean(user && allowManagement));
  const assignAsset = useAssignAsset();
  const returnAsset = useReturnAsset();
  const changeStatus = useChangeAssetStatus();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [nextStatus, setNextStatus] = useState<ManualAssetStatus | "">("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const deferredUserSearch = useDeferredValue(userSearch.trim());

  const visibleUsers = useMemo(() => {
    const keyword = normalizeSearch(deferredUserSearch);
    return (usersQuery.data ?? []).filter(
      (item) => item.isActive && !item.isLocked && matchesUser(item, keyword),
    );
  }, [deferredUserSearch, usersQuery.data]);

  if (!assetId) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-panel">
        <CardContent className="pt-0">
          <CardTitle>ID tài sản không hợp lệ</CardTitle>
          <CardDescription className="mt-1">
            Hãy kiểm tra lại đường dẫn và thử lại.
          </CardDescription>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/assets">Quay lại danh sách</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (assetQuery.isLoading || !user) {
    return <AssetDetailSkeleton />;
  }

  if (assetQuery.isError || !assetQuery.data) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-panel">
        <CardContent className="flex items-start gap-3 pt-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </span>
          <div>
            <CardTitle>Không thể tải chi tiết tài sản</CardTitle>
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
  const assignments = historyQuery.data ?? [];
  const currentAssignment = assignments.find(
    (assignment) => !assignment.returnedAt,
  );
  const linkedTickets = asset.tickets ?? [];
  const isAssigning = assignAsset.isPending;
  const isReturning = returnAsset.isPending;
  const isChangingStatus = changeStatus.isPending;

  async function handleAssign() {
    const userId = Number(selectedUserId);

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !(usersQuery.data ?? []).some(
        (item) => item.id === userId && item.isActive && !item.isLocked,
      )
    ) {
      setFeedback({
        message:
          "Hãy chọn nhân viên đang hoạt động và không bị khóa để nhận tài sản.",
        tone: "error",
      });
      return;
    }

    try {
      const selectedUser = (usersQuery.data ?? []).find(
        (item) => item.id === userId,
      );

      await assignAsset.mutateAsync({
        id: asset.id,
        input: { userId },
      });
      setSelectedUserId("");
      setUserSearch("");
      setFeedback({
        message: `Đã cấp phát tài sản cho ${selectedUser?.name ?? "người dùng đã chọn"}. Email thông báo sẽ được gửi nếu tính năng email đang bật.`,
        tone: "success",
      });
    } catch (error) {
      setFeedback({
        message: getApiErrorMessage(
          error,
          "Không thể gán tài sản. Vui lòng thử lại.",
        ),
        tone: "error",
      });
    }
  }

  async function handleReturn() {
    try {
      const previousAssigneeName = asset.assignedTo?.name;

      await returnAsset.mutateAsync({
        id: asset.id,
        input: { notes: returnNotes.trim() || undefined },
      });
      setReturnNotes("");
      setFeedback({
        message: `Đã thu hồi tài sản${previousAssigneeName ? ` từ ${previousAssigneeName}` : ""}. Email xác nhận sẽ được gửi nếu tính năng email đang bật.`,
        tone: "success",
      });
    } catch (error) {
      setFeedback({
        message: getApiErrorMessage(
          error,
          "Không thể thu hồi tài sản. Vui lòng thử lại.",
        ),
        tone: "error",
      });
    }
  }

  async function handleChangeStatus() {
    if (!nextStatus) {
      setFeedback({
        message: "Hãy chọn trạng thái mới.",
        tone: "error",
      });
      return;
    }

    try {
      await changeStatus.mutateAsync({
        id: asset.id,
        input: { status: nextStatus },
      });
      setNextStatus("");
      setFeedback({
        message: "Đã cập nhật trạng thái tài sản.",
        tone: "success",
      });
    } catch (error) {
      setFeedback({
        message: getApiErrorMessage(
          error,
          "Không thể đổi trạng thái tài sản. Vui lòng thử lại.",
        ),
        tone: "error",
      });
    }
  }

  return (
    <div className="grid gap-6 motion-enter">
      <AssetToast
        message={feedback?.message ?? null}
        tone={feedback?.tone}
        onClose={() => setFeedback(null)}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2 mb-2">
            <Link href="/assets">
              <ArrowLeft className="size-4" />
              Quay lại
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <AssetStatusBadge status={asset.status} />
            <AssetTypeBadge type={asset.type} />
            <Badge variant="outline">{asset.assetTag}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">
            {asset.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cập nhật lần cuối: {formatAssetDate(asset.updatedAt, true)}
          </p>
        </div>
        {allowManagement ? (
          <Button asChild variant="outline">
            <Link href={`/assets/${asset.id}/edit`}>
              <Edit3 className="size-4" />
              Chỉnh sửa
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <AssetInformation asset={asset} assignments={assignments} />

          {allowManagement && (
            <AssetMaintenancePanel
              assetId={assetId}
              supplierName={asset.supplierName}
              canSchedule={
                asset.status !== "RETIRED" && asset.status !== "LOST"
              }
            />
          )}

          <Card className="shadow-sm motion-panel">
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <TicketCheck className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle>Ticket liên quan</CardTitle>
                  <CardDescription>
                    Tối đa 10 ticket gần nhất mà bạn có quyền xem.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {linkedTickets.length ? (
                <div className="grid gap-3">
                  {linkedTickets.map((ticket, index) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="motion-row flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:border-teal-200 hover:bg-teal-50/30 sm:flex-row sm:items-center sm:justify-between"
                      style={{ "--motion-index": index } as CSSProperties}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          #{ticket.id} {ticket.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatAssetDate(ticket.createdAt, true)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <TicketStatusBadge status={ticket.status} />
                        <TicketPriorityBadge priority={ticket.priority} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-44 place-items-center rounded-lg border border-dashed p-5 text-center">
                  <div>
                    <PackageOpen className="mx-auto size-7 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold">
                      Chưa có ticket liên quan
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ticket được liên kết với tài sản sẽ xuất hiện tại đây.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {allowManagement ? (
            <AssetAssignmentHistory
              historyQuery={historyQuery}
              assignments={assignments}
            />
          ) : null}
        </div>

        <aside className="grid content-start gap-4">
          <Card className="shadow-sm motion-panel">
            <CardHeader className="border-b">
              <CardTitle>Người đang sử dụng</CardTitle>
              <CardDescription>
                Trạng thái cấp phát hiện tại của tài sản.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {asset.assignedTo ? (
                <div className="flex gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-200">
                    <UserRound className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {asset.assignedTo.name}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {asset.assignedTo.email}
                    </p>
                    {asset.assignedTo.department?.name ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {asset.assignedTo.department.name}
                      </p>
                    ) : null}
                    {currentAssignment ? (
                      <p className="mt-3 text-xs font-medium text-sky-800 dark:text-sky-200">
                        Gán lúc{" "}
                        {formatAssetDate(currentAssignment.assignedAt, true)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <UserRound className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">Chưa được gán</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tài sản hiện không có người sử dụng.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {allowManagement && asset.status === "AVAILABLE" ? (
            <AssetAssignmentPanel
              usersQuery={usersQuery}
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              isAssigning={isAssigning}
              selectedUserId={selectedUserId}
              setSelectedUserId={setSelectedUserId}
              visibleUsers={visibleUsers}
              handleAssign={handleAssign}
            />
          ) : null}

          {allowManagement && asset.status === "ASSIGNED" ? (
            <AssetReturnPanel
              returnNotes={returnNotes}
              setReturnNotes={setReturnNotes}
              isReturning={isReturning}
              handleReturn={handleReturn}
            />
          ) : null}

          {allowManagement && asset.status !== "ASSIGNED" ? (
            <AssetStatusPanel
              nextStatus={nextStatus}
              setNextStatus={setNextStatus}
              isChangingStatus={isChangingStatus}
              asset={asset}
              handleChangeStatus={handleChangeStatus}
            />
          ) : null}

          <Card className="shadow-sm motion-panel">
            <CardHeader className="border-b">
              <CardTitle>Ghi chú</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {asset.notes || "Chưa có ghi chú cho tài sản này."}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
