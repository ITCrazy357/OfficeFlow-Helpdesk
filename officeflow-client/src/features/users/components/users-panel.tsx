"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
} from "@/shared/components/ui/state-block";
import { formatDate } from "@/shared/lib/format";
import { userService } from "@/features/users/services/user-service";
import type { User } from "@/features/users/types";

export function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    userService
      .list()
      .then((result) => {
        if (isMounted) {
          setUsers(result);
          setError("");
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Không tải được người dùng",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <LoadingBlock title="Đang tải người dùng" />;
  }

  if (error) {
    return <ErrorBlock title="Không tải được người dùng" message={error} />;
  }

  if (users.length === 0) {
    return (
      <EmptyBlock
        title="Chưa có người dùng"
        message="Backend trả về danh sách người dùng rỗng."
      />
    );
  }

  return (
    <section className="motion-panel overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03]">
      <div className="flex flex-col gap-1 border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-4">
        <h2 className="text-base font-semibold text-zinc-950">
          Danh sách người dùng
        </h2>
        <p className="text-sm text-zinc-600">{users.length} người dùng</p>
      </div>

      <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-4 border-b border-zinc-200 bg-zinc-950 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-300 max-md:hidden">
        <span>Người dùng</span>
        <span>Phòng ban</span>
        <span>Role</span>
        <span>Ngày tạo</span>
      </div>

      {users.map((user, index) => (
        <article
          key={user.id}
          style={{ "--motion-index": index } as CSSProperties}
          className="motion-row grid gap-3 border-b border-zinc-100 px-4 py-4 last:border-0 hover:bg-teal-50/30 hover:shadow-[inset_3px_0_0_rgba(15,118,110,0.35)] md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr] md:items-center"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 transition duration-200">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-zinc-950">
                {user.name}
              </h2>
              <p className="truncate text-sm text-zinc-600">{user.email}</p>
            </div>
          </div>

          <span className="text-sm text-zinc-700">
            <span className="mb-1 block text-xs font-semibold text-zinc-500 md:hidden">
              Phòng ban
            </span>
            {user.department?.name ?? "-"}
          </span>

          <Badge tone={user.role === "ADMIN" ? "amber" : "blue"}>
            {user.role}
          </Badge>

          <span className="text-sm text-zinc-600">
            <span className="mb-1 block text-xs font-semibold text-zinc-500 md:hidden">
              Ngày tạo
            </span>
            {formatDate(user.createdAt)}
          </span>
        </article>
      ))}
    </section>
  );
}
