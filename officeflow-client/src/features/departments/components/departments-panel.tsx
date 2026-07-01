"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Building2 } from "lucide-react";
import { formatDate } from "@/shared/lib/format";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
} from "@/shared/components/ui/state-block";
import { departmentService } from "@/features/departments/services/department-service";
import type { Department } from "@/features/departments/types";

export function DepartmentsPanel() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    departmentService
      .list()
      .then((result) => {
        if (isMounted) {
          setDepartments(result);
          setError("");
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Không tải được phòng ban",
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
    return <LoadingBlock title="Đang tải danh sách phòng ban" />;
  }

  if (error) {
    return <ErrorBlock title="Không tải được phòng ban" message={error} />;
  }

  if (departments.length === 0) {
    return (
      <EmptyBlock
        title="Chưa có phòng ban"
        message="Backend trả về danh sách phòng ban rỗng."
      />
    );
  }

  return (
    <section className="motion-panel rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] backdrop-blur">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">
            Danh sách phòng ban
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {departments.length} phòng ban
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {departments.map((department, index) => (
          <article
            key={department.id}
            style={{ "--motion-index": index } as CSSProperties}
            className="motion-card group flex min-h-32 items-start justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-950/[0.03] hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-950/[0.06]"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 transition duration-200 group-hover:bg-teal-100 group-hover:text-teal-800">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-zinc-950">
                  {department.name}
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Cập nhật {formatDate(department.updatedAt)}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
              #{department.id}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
