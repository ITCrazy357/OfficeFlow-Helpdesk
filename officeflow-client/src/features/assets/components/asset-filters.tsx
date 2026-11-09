"use client";
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
import {
  assetStatusOptions,
  assetTypeOptions,
} from "@/features/assets/constants";
import type { AssetStatus, AssetType } from "@/features/assets/types";
import { useUsers } from "@/features/users/hooks";
import type { UserListItem } from "@/features/users/types";
import { RotateCcw, Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

type Props = {
  hasFilters: boolean;
  resetFilters: () => void;
  keyword: string;
  setKeyword: Dispatch<SetStateAction<string>>;
  setPage: Dispatch<SetStateAction<number>>;
  type: "ALL" | AssetType;
  setType: Dispatch<SetStateAction<"ALL" | AssetType>>;
  status: "ALL" | AssetStatus;
  setStatus: Dispatch<SetStateAction<"ALL" | AssetStatus>>;
  allowManagement: boolean;
  warranty: "ALL" | "EXPIRING" | "EXPIRED";
  setWarranty: Dispatch<SetStateAction<"ALL" | "EXPIRING" | "EXPIRED">>;
  assignedToId: string;
  setAssignedToId: Dispatch<SetStateAction<string>>;
  usersQuery: ReturnType<typeof useUsers>;
  activeUsers: UserListItem[];
};
export function AssetFilters({
  hasFilters,
  resetFilters,
  keyword,
  setKeyword,
  setPage,
  type,
  setType,
  status,
  setStatus,
  allowManagement,
  warranty,
  setWarranty,
  assignedToId,
  setAssignedToId,
  usersQuery,
  activeUsers,
}: Props) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Bộ lọc tài sản</CardTitle>
            <CardDescription className="mt-1">
              Tìm theo mã, tên, thương hiệu, model hoặc số serial.
            </CardDescription>
          </div>
          {hasFilters ? (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <RotateCcw className="size-4" />
              Đặt lại
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            className="pl-9"
            placeholder="Tìm tài sản..."
            aria-label="Tìm tài sản"
          />
        </div>
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value as AssetType | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Loại tài sản" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả loại</SelectItem>
            {assetTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as AssetStatus | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            {assetStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {allowManagement ? (
          <Select
            value={warranty}
            onValueChange={(value) => {
              setWarranty(value as typeof warranty);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Lọc bảo hành">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả hạn bảo hành</SelectItem>
              <SelectItem value="EXPIRING">Sắp hết trong 30 ngày</SelectItem>
              <SelectItem value="EXPIRED">Đã hết bảo hành</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {allowManagement ? (
          <Select
            value={assignedToId}
            onValueChange={(value) => {
              setAssignedToId(value);
              setPage(1);
            }}
            disabled={usersQuery.isLoading || usersQuery.isError}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Người sử dụng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả người dùng</SelectItem>
              {activeUsers.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name} / {item.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </CardContent>
    </Card>
  );
}
