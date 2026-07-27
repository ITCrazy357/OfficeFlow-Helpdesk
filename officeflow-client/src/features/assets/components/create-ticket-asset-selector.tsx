"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { AlertCircle, Boxes, Search } from "lucide-react";

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
import { getApiErrorMessage } from "@/lib/axios";

import { getAssetModelLabel } from "../constants";
import { useAssets, useMyAssets } from "../hooks";
import type { Asset } from "../types";

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
  return normalizeSearch(
    [asset.assetTag, asset.name, asset.brand, asset.model, asset.serialNumber]
      .filter(Boolean)
      .join(" "),
  ).includes(keyword);
}

export function CreateTicketAssetSelector({
  currentUser,
  value,
  onValueChange,
  disabled = false,
}: {
  currentUser?: AuthUser;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const allowManagement = canManageAssets(currentUser?.role);
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim());
  const assetsQuery = useAssets(
    {
      page: 1,
      limit: 50,
      keyword: deferredKeyword || undefined,
    },
    Boolean(currentUser && allowManagement),
  );
  const myAssetsQuery = useMyAssets(
    Boolean(currentUser && !allowManagement),
  );

  const filteredMyAssets = useMemo(() => {
    const normalizedKeyword = normalizeSearch(deferredKeyword);

    if (!normalizedKeyword) {
      return myAssetsQuery.data ?? [];
    }

    return (myAssetsQuery.data ?? []).filter((asset) =>
      matchesAsset(asset, normalizedKeyword),
    );
  }, [deferredKeyword, myAssetsQuery.data]);

  const options = allowManagement
    ? (assetsQuery.data?.items ?? [])
    : filteredMyAssets;
  const query = allowManagement ? assetsQuery : myAssetsQuery;

  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>Tài sản liên quan</CardTitle>
            <CardDescription>
              Tùy chọn liên kết thiết bị sau khi tạo ticket.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0">
        {query.isLoading || !currentUser ? (
          <div className="grid gap-2">
            <div className="h-10 rounded-lg bg-muted motion-shimmer" />
            <div className="h-10 rounded-lg bg-muted motion-shimmer" />
          </div>
        ) : query.isError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  Không thể tải danh sách tài sản.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {getApiErrorMessage(query.error)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => query.refetch()}
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
                placeholder="Tìm mã, tên hoặc model"
                disabled={disabled}
              />
            </div>
            <Select
              value={value}
              onValueChange={onValueChange}
              disabled={disabled || options.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Không liên kết tài sản" />
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
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => onValueChange("")}
                disabled={disabled}
              >
                Bỏ chọn tài sản
              </Button>
            ) : null}
            {options.length === 0 ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {allowManagement
                  ? "Không tìm thấy tài sản trong danh sách quản lý."
                  : "Bạn chưa có tài sản được cấp để liên kết."}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
