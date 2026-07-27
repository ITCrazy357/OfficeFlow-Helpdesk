"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertCircle,
  Boxes,
  Link2,
  Link2Off,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthUser } from "@/features/auth/types";
import {
  useLinkTicketAsset,
  useUnlinkTicketAsset,
} from "@/features/tickets/hooks";
import type { Ticket } from "@/features/tickets/types";
import { getApiErrorMessage } from "@/lib/axios";

import { getAssetModelLabel } from "../constants";
import { useAssets, useMyAssets } from "../hooks";
import type { Asset } from "../types";
import { AssetStatusBadge, AssetTypeBadge } from "./asset-badges";
import { AssetToast } from "./asset-toast";

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

function matchesAsset(asset: Asset, keyword: string) {
  if (!keyword) {
    return true;
  }

  return normalizeSearch(
    [asset.assetTag, asset.name, asset.brand, asset.model, asset.serialNumber]
      .filter(Boolean)
      .join(" "),
  ).includes(keyword);
}

export function TicketAssetPanel({
  ticket,
  currentUser,
}: {
  ticket: Ticket;
  currentUser?: AuthUser;
}) {
  const allowManagement = canManageAssets(currentUser?.role);
  const canSelectAsset = Boolean(currentUser && !ticket.asset);
  const [keyword, setKeyword] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const deferredKeyword = useDeferredValue(keyword.trim());
  const managedAssetsQuery = useAssets(
    {
      page: 1,
      limit: 50,
      keyword: deferredKeyword || undefined,
    },
    canSelectAsset && allowManagement,
  );
  const myAssetsQuery = useMyAssets(canSelectAsset && !allowManagement);
  const linkAsset = useLinkTicketAsset();
  const unlinkAsset = useUnlinkTicketAsset();

  const myAssets = useMemo(() => {
    const normalizedKeyword = normalizeSearch(deferredKeyword);
    return (myAssetsQuery.data ?? []).filter((asset) =>
      matchesAsset(asset, normalizedKeyword),
    );
  }, [deferredKeyword, myAssetsQuery.data]);

  const options = allowManagement
    ? (managedAssetsQuery.data?.items ?? [])
    : myAssets;
  const optionsQuery = allowManagement ? managedAssetsQuery : myAssetsQuery;

  async function handleLink() {
    const assetId = Number(selectedAssetId);

    if (!Number.isInteger(assetId) || assetId <= 0) {
      setFeedback({
        message: "Hãy chọn tài sản cần liên kết.",
        tone: "error",
      });
      return;
    }

    try {
      await linkAsset.mutateAsync({
        id: ticket.id,
        input: { assetId },
      });
      setSelectedAssetId("");
      setKeyword("");
      setFeedback({
        message: "Đã liên kết tài sản với ticket.",
        tone: "success",
      });
    } catch (error) {
      setFeedback({
        message: getApiErrorMessage(
          error,
          "Không thể liên kết tài sản. Vui lòng thử lại.",
        ),
        tone: "error",
      });
    }
  }

  async function handleUnlink() {
    try {
      await unlinkAsset.mutateAsync(ticket.id);
      setFeedback({
        message: "Đã gỡ liên kết tài sản khỏi ticket.",
        tone: "success",
      });
    } catch (error) {
      setFeedback({
        message: getApiErrorMessage(
          error,
          "Không thể gỡ liên kết tài sản. Vui lòng thử lại.",
        ),
        tone: "error",
      });
    }
  }

  return (
    <Card className="shadow-sm motion-panel">
      <AssetToast
        message={feedback?.message ?? null}
        tone={feedback?.tone}
        onClose={() => setFeedback(null)}
      />
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>Tài sản liên quan</CardTitle>
            <CardDescription>
              Thiết bị trực tiếp phát sinh yêu cầu hỗ trợ này.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {ticket.asset ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal-950/5 text-teal-950">
                  <Boxes className="size-5" />
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/assets/${ticket.asset.id}`}
                    className="font-semibold hover:text-teal-800"
                  >
                    {ticket.asset.name}
                  </Link>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {ticket.asset.assetTag}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {getAssetModelLabel(ticket.asset)}
                    {ticket.asset.serialNumber
                      ? ` / ${ticket.asset.serialNumber}`
                      : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AssetStatusBadge status={ticket.asset.status} />
                    <AssetTypeBadge type={ticket.asset.type} />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/assets/${ticket.asset.id}`}>
                    <Link2 className="size-4" />
                    Xem tài sản
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={unlinkAsset.isPending}
                  aria-label="Gỡ liên kết tài sản"
                >
                  {unlinkAsset.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Link2Off className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {optionsQuery.isLoading ? (
              <div className="grid gap-2">
                <div className="h-10 rounded-lg bg-muted motion-shimmer" />
                <div className="h-10 rounded-lg bg-muted motion-shimmer" />
              </div>
            ) : optionsQuery.isError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Không thể tải tài sản có thể liên kết.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getApiErrorMessage(optionsQuery.error)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => optionsQuery.refetch()}
                >
                  Thử lại
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    className="pl-9"
                    placeholder="Tìm theo mã, tên, model hoặc serial"
                    disabled={linkAsset.isPending}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={selectedAssetId}
                    onValueChange={setSelectedAssetId}
                    disabled={linkAsset.isPending || options.length === 0}
                  >
                    <SelectTrigger className="w-full sm:flex-1">
                      <SelectValue placeholder="Chọn tài sản" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((asset) => (
                        <SelectItem key={asset.id} value={String(asset.id)}>
                          <div className="grid gap-0.5">
                            <span className="font-medium">{asset.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {asset.assetTag} / {getAssetModelLabel(asset)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                      {options.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                          Không có tài sản phù hợp.
                        </div>
                      ) : null}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={handleLink}
                    disabled={linkAsset.isPending || !selectedAssetId}
                  >
                    {linkAsset.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Link2 className="size-4" />
                    )}
                    Liên kết
                  </Button>
                </div>
                {options.length === 0 ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {allowManagement
                      ? "Không tìm thấy tài sản trong danh sách quản lý."
                      : "Bạn chưa có tài sản được cấp để liên kết."}
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
