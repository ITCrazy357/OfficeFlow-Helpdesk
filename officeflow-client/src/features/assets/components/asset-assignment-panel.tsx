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
import { useUsers } from "@/features/users/hooks";
import type { UserListItem } from "@/features/users/types";
import { Loader2, MailCheck, Search, UserRound } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

type Props = {
  usersQuery: ReturnType<typeof useUsers>;
  userSearch: string;
  setUserSearch: Dispatch<SetStateAction<string>>;
  isAssigning: boolean;
  selectedUserId: string;
  setSelectedUserId: Dispatch<SetStateAction<string>>;
  visibleUsers: UserListItem[];
  handleAssign: () => Promise<void>;
};
export function AssetAssignmentPanel({
  usersQuery,
  userSearch,
  setUserSearch,
  isAssigning,
  selectedUserId,
  setSelectedUserId,
  visibleUsers,
  handleAssign,
}: Props) {
  return (
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
                type="search"
                aria-label="Tìm tên, email, phòng ban"
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
            <div className="flex items-start gap-2 rounded-lg border border-sky-200/80 dark:border-sky-400/25 bg-sky-50/70 dark:bg-sky-400/10 p-3 text-xs leading-5 text-sky-900 dark:text-sky-200">
              <MailCheck className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Người nhận sẽ được gửi email cấp phát nếu tính năng email đang
                bật.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleAssign}
              disabled={
                isAssigning ||
                !(usersQuery.data ?? []).some(
                  (item) =>
                    String(item.id) === selectedUserId &&
                    item.isActive &&
                    !item.isLocked,
                )
              }
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
  );
}
