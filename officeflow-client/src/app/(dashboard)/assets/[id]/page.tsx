"use client";

import type { CSSProperties } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  CalendarDays,
  Edit3,
  History,
  Link2,
  Loader2,
  PackageOpen,
  RotateCcw,
  Search,
  TicketCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AssetStatusBadge,
  AssetTypeBadge,
} from "@/features/assets/components/asset-badges";
import { AssetToast } from "@/features/assets/components/asset-toast";
import {
  formatAssetDate,
  getAssetModelLabel,
  manualAssetStatusOptions,
} from "@/features/assets/constants";
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
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <div className="h-80 rounded-lg bg-muted motion-shimmer" />
          <div className="h-64 rounded-lg bg-muted motion-shimmer" />
        </div>
        <div className="h-96 rounded-lg bg-muted motion-shimmer" />
      </div>
    </div>
  );
}

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
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-950/5 text-teal-950">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold">{value}</p>
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
      (item) => item.isActive && matchesUser(item, keyword),
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

    if (!Number.isInteger(userId) || userId <= 0) {
      setFeedback({
        message: "Hãy chọn nhân viên nhận tài sản.",
        tone: "error",
      });
      return;
    }

    try {
      await assignAsset.mutateAsync({
        id: asset.id,
        input: { userId },
      });
      setSelectedUserId("");
      setUserSearch("");
      setFeedback({
        message: "Đã gán tài sản cho người dùng.",
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
      await returnAsset.mutateAsync({
        id: asset.id,
        input: { notes: returnNotes.trim() || undefined },
      });
      setReturnNotes("");
      setFeedback({
        message: "Đã ghi nhận thu hồi tài sản.",
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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
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
                value={formatAssetDate(asset.warrantyUntil)}
                icon={Wrench}
              />
              <DetailItem
                label="Ngày tạo"
                value={formatAssetDate(asset.createdAt, true)}
                icon={CalendarDays}
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
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700">
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
                                ? "border-slate-200 bg-slate-50 text-slate-700"
                                : "border-sky-200 bg-sky-50 text-sky-800"
                            }
                          >
                            {assignment.returnedAt
                              ? "Đã thu hồi"
                              : "Đang sử dụng"}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>
                            Ngày gán:{" "}
                            {formatAssetDate(assignment.assignedAt, true)}
                          </p>
                          <p>
                            Ngày trả:{" "}
                            {formatAssetDate(assignment.returnedAt, true)}
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
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700">
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
                      <p className="mt-3 text-xs font-medium text-sky-800">
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
            <Card className="shadow-sm motion-panel">
              <CardHeader className="border-b">
                <CardTitle>Gán tài sản</CardTitle>
                <CardDescription>
                  Chọn một tài khoản đang hoạt động để cấp phát.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0">
                {usersQuery.isLoading ? (
                  <div className="grid gap-2">
                    <div className="h-10 rounded-lg bg-muted motion-shimmer" />
                    <div className="h-10 rounded-lg bg-muted motion-shimmer" />
                  </div>
                ) : usersQuery.isError ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-sm font-medium text-destructive">
                      Không thể tải danh sách người dùng.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => usersQuery.refetch()}
                    >
                      Thử lại
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        className="pl-9"
                        placeholder="Tìm tên, email, phòng ban"
                        disabled={isAssigning}
                      />
                    </div>
                    <Select
                      value={selectedUserId}
                      onValueChange={setSelectedUserId}
                      disabled={isAssigning || visibleUsers.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn người nhận" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleUsers.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            <div className="grid gap-0.5">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {[item.email, item.department?.name]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                        {visibleUsers.length === 0 ? (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Không tìm thấy người dùng phù hợp.
                          </div>
                        ) : null}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={handleAssign}
                      disabled={isAssigning || !selectedUserId}
                    >
                      {isAssigning ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserRound className="size-4" />
                      )}
                      {isAssigning ? "Đang gán..." : "Xác nhận cấp phát"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {allowManagement && asset.status === "ASSIGNED" ? (
            <Card className="border-amber-200 bg-amber-50/40 shadow-sm motion-panel">
              <CardHeader className="border-b border-amber-200">
                <CardTitle>Thu hồi tài sản</CardTitle>
                <CardDescription>
                  Ghi chú tình trạng khi nhận lại nếu cần.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0">
                <div className="grid gap-2">
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
                <Button
                  type="button"
                  variant="outline"
                  className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
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
          ) : null}

          {allowManagement && asset.status !== "ASSIGNED" ? (
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
                  onValueChange={(value) =>
                    setNextStatus(value as ManualAssetStatus)
                  }
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
