"use client";
import { AssetFilters } from "@/features/assets/components/asset-filters";
import { AssetList } from "@/features/assets/components/asset-list";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import AssetCareOverview from "@/features/assets/components/asset-care-overview";
import { useAssets, useMyAssets } from "@/features/assets/hooks";
import type { Asset, AssetStatus, AssetType } from "@/features/assets/types";
import { useMe } from "@/features/auth/hooks";
import { useUsers } from "@/features/users/hooks";

const PAGE_SIZE = 10;

function canManageAssets(role?: string) {
  return role === "ADMIN" || role === "IT_STAFF";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesAssetSearch(asset: Asset, keyword: string) {
  if (!keyword) {
    return true;
  }

  return normalizeSearch(
    [asset.assetTag, asset.name, asset.brand, asset.model, asset.serialNumber]
      .filter(Boolean)
      .join(" "),
  ).includes(keyword);
}

export default function AssetsPage() {
  const { data: user } = useMe();
  const allowManagement = canManageAssets(user?.role);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<AssetType | "ALL">("ALL");
  const [status, setStatus] = useState<AssetStatus | "ALL">("ALL");
  const [assignedToId, setAssignedToId] = useState<string>("ALL");
  const [warranty, setWarranty] = useState<"ALL" | "EXPIRING" | "EXPIRED">(
    "ALL",
  );
  const deferredKeyword = useDeferredValue(keyword.trim());
  const normalizedKeyword = normalizeSearch(deferredKeyword);

  const assetsQuery = useAssets(
    {
      page,
      limit: PAGE_SIZE,
      keyword: deferredKeyword || undefined,
      type: type === "ALL" ? undefined : type,
      status: status === "ALL" ? undefined : status,
      warranty: warranty === "ALL" ? undefined : warranty,
      assignedToId: assignedToId === "ALL" ? undefined : Number(assignedToId),
    },
    Boolean(user && allowManagement),
  );
  const myAssetsQuery = useMyAssets(Boolean(user && !allowManagement));
  const usersQuery = useUsers(Boolean(user && allowManagement));

  const filteredMyAssets = useMemo(() => {
    return (myAssetsQuery.data ?? []).filter(
      (asset) =>
        matchesAssetSearch(asset, normalizedKeyword) &&
        (type === "ALL" || asset.type === type) &&
        (status === "ALL" || asset.status === status),
    );
  }, [myAssetsQuery.data, normalizedKeyword, status, type]);

  const myTotalPages = Math.max(
    1,
    Math.ceil(filteredMyAssets.length / PAGE_SIZE),
  );
  const myAssets = filteredMyAssets.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const assets = allowManagement ? (assetsQuery.data?.items ?? []) : myAssets;
  const pagination = allowManagement
    ? assetsQuery.data?.pagination
    : {
        page,
        limit: PAGE_SIZE,
        totalItems: filteredMyAssets.length,
        totalPages: myTotalPages,
      };
  const activeUsers = (usersQuery.data ?? []).filter((item) => item.isActive);
  const isLoading = !user
    ? true
    : allowManagement
      ? assetsQuery.isLoading
      : myAssetsQuery.isLoading;
  const isError = allowManagement ? assetsQuery.isError : myAssetsQuery.isError;
  const queryError = allowManagement ? assetsQuery.error : myAssetsQuery.error;
  const hasFilters =
    keyword.trim().length > 0 ||
    type !== "ALL" ||
    status !== "ALL" ||
    assignedToId !== "ALL" ||
    warranty !== "ALL";

  function resetFilters() {
    setKeyword("");
    setType("ALL");
    setStatus("ALL");
    setAssignedToId("ALL");
    setWarranty("ALL");
    setPage(1);
  }

  function refetchAssets() {
    if (allowManagement) {
      assetsQuery.refetch();
      return;
    }

    myAssetsQuery.refetch();
  }

  return (
    <div className="grid gap-6 motion-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            {allowManagement ? "Quản lý tài sản" : "Tài sản của tôi"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {allowManagement
              ? "Theo dõi trạng thái, người sử dụng và các ticket liên quan đến thiết bị."
              : "Xem các thiết bị hiện được cấp cho bạn và lịch sử hỗ trợ liên quan."}
          </p>
        </div>
        {allowManagement ? (
          <Button asChild>
            <Link href="/assets/new">
              <Plus className="size-4" />
              Thêm tài sản
            </Link>
          </Button>
        ) : null}
      </div>

      {allowManagement && <AssetCareOverview />}

      <AssetFilters
        hasFilters={hasFilters}
        resetFilters={resetFilters}
        keyword={keyword}
        setKeyword={setKeyword}
        setPage={setPage}
        type={type}
        setType={setType}
        status={status}
        setStatus={setStatus}
        allowManagement={allowManagement}
        warranty={warranty}
        setWarranty={setWarranty}
        assignedToId={assignedToId}
        setAssignedToId={setAssignedToId}
        usersQuery={usersQuery}
        activeUsers={activeUsers}
      />

      <AssetList
        pagination={pagination}
        isLoading={isLoading}
        isError={isError}
        queryError={queryError}
        refetchAssets={refetchAssets}
        assets={assets}
        hasFilters={hasFilters}
        allowManagement={allowManagement}
        resetFilters={resetFilters}
        setPage={setPage}
        page={page}
      />
    </div>
  );
}
