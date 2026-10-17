"use client";

import { useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/features/auth/hooks";
import { useSlaPolicy, useUpdateSlaPolicy } from "@/features/sla/hooks";
import type { SlaPolicy, SlaPolicyConfig } from "@/features/sla/types";
import { ticketPriorityOptions } from "@/features/tickets/constants";
import { getApiErrorMessage } from "@/lib/axios";

function PolicyForm({
  policy,
  onSaved,
  onReload,
}: {
  policy: SlaPolicy;
  onSaved: () => void;
  onReload: () => void;
}) {
  const [config, setConfig] = useState<SlaPolicyConfig>(() =>
    structuredClone(policy.config),
  );
  const [holidays, setHolidays] = useState(policy.config.holidays.join("\n"));
  const [error, setError] = useState("");
  const update = useUpdateSlaPolicy();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (update.isPending) return;
    setError("");
    try {
      await update.mutateAsync({
        version: policy.version,
        config: {
          ...config,
          holidays: holidays
            .split(/\r?\n/)
            .map((date) => date.trim())
            .filter(Boolean),
        },
      });
      onSaved();
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể lưu chính sách SLA."));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <fieldset disabled={update.isPending} className="grid min-w-0 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Lịch tính SLA</CardTitle>
            <CardDescription>
              Chỉ thời gian nằm trong lịch làm việc mới được tính ở chế độ giờ
              hành chính.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sla-mode">Cách tính thời gian</Label>
                <select
                  id="sla-mode"
                  className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
                  value={config.mode}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      mode: event.target.value as SlaPolicyConfig["mode"],
                    })
                  }
                >
                  <option value="BUSINESS">Giờ hành chính</option>
                  <option value="CALENDAR">Liên tục 24/7</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sla-timezone">Múi giờ</Label>
                <Input
                  id="sla-timezone"
                  required
                  maxLength={100}
                  value={config.timezone}
                  onChange={(event) =>
                    setConfig({ ...config, timezone: event.target.value })
                  }
                  placeholder="Asia/Ho_Chi_Minh"
                />
              </div>
            </div>
            {config.mode === "BUSINESS" ? (
              <>
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Ngày làm việc</p>
                  <div className="flex flex-wrap gap-4">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                      <label
                        key={day}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="of-checkbox"
                          checked={config.workingDays.includes(day)}
                          onChange={(event) =>
                            setConfig({
                              ...config,
                              workingDays: event.target.checked
                                ? [...config.workingDays, day].sort()
                                : config.workingDays.filter(
                                    (item) => item !== day,
                                  ),
                            })
                          }
                        />
                        {day === 7 ? "Chủ nhật" : `Thứ ${day + 1}`}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3">
                  <p className="text-sm font-medium">Khung giờ làm việc</p>
                  {config.workingHours.map((interval, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Input
                        type="time"
                        aria-label={`Giờ bắt đầu khung ${index + 1}`}
                        required
                        className="w-32"
                        value={interval.start}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            workingHours: config.workingHours.map((item, i) =>
                              i === index
                                ? { ...item, start: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <span>đến</span>
                      <Input
                        type="time"
                        aria-label={`Giờ kết thúc khung ${index + 1}`}
                        required
                        className="w-32"
                        value={interval.end}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            workingHours: config.workingHours.map((item, i) =>
                              i === index
                                ? { ...item, end: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`Xóa khung giờ ${index + 1}`}
                        onClick={() =>
                          setConfig({
                            ...config,
                            workingHours: config.workingHours.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        Xóa
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    disabled={config.workingHours.length >= 8}
                    onClick={() =>
                      setConfig({
                        ...config,
                        workingHours: [
                          ...config.workingHours,
                          { start: "", end: "" },
                        ],
                      })
                    }
                  >
                    Thêm khung giờ
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Nhập theo thứ tự trong ngày, không trùng nhau. Mỗi khung dài
                    ít nhất 15 phút.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sla-holidays">Ngày nghỉ lễ/Tết</Label>
                  <Textarea
                    id="sla-holidays"
                    rows={5}
                    value={holidays}
                    onChange={(event) => setHolidays(event.target.value)}
                    placeholder={"2027-01-01\n2027-02-05"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mỗi dòng một ngày YYYY-MM-DD, nhập đủ các ngày nghỉ của từng
                    năm. Hệ thống không tự suy ra ngày Tết hay nghỉ bù.
                  </p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Thời hạn theo độ ưu tiên</CardTitle>
            <CardDescription>
              Đơn vị phút. Trong chế độ giờ hành chính, 480 phút tương đương một
              ngày làm việc 8 giờ.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-0">
            {ticketPriorityOptions.map((priority) => (
              <div
                key={priority.value}
                className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[120px_1fr_1fr]"
              >
                <p className="self-center text-sm font-semibold">
                  {priority.label}
                </p>
                <div className="grid gap-2">
                  <Label htmlFor={`sla-response-${priority.value}`}>
                    Phản hồi đầu tiên
                  </Label>
                  <Input
                    id={`sla-response-${priority.value}`}
                    type="number"
                    min={1}
                    max={43200}
                    placeholder="Để trống để tắt"
                    value={config.targets[priority.value].responseMinutes ?? ""}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        targets: {
                          ...config.targets,
                          [priority.value]: {
                            ...config.targets[priority.value],
                            responseMinutes:
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`sla-resolution-${priority.value}`}>
                    Hoàn tất xử lý
                  </Label>
                  <Input
                    id={`sla-resolution-${priority.value}`}
                    type="number"
                    required
                    min={1}
                    max={43200}
                    value={config.targets[priority.value].resolutionMinutes}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        targets: {
                          ...config.targets,
                          [priority.value]: {
                            ...config.targets[priority.value],
                            resolutionMinutes: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <p className="text-xs leading-5 text-muted-foreground">
              Phản hồi đầu tiên là bình luận đầu tiên của ADMIN/IT_STAFF khác
              người gửi yêu cầu. Giao ticket hoặc đổi trạng thái chưa được tính
              là phản hồi.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cảnh báo và chuyển cấp</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sla-warning">Cảnh báo trước hạn (phút)</Label>
              <Input
                id="sla-warning"
                type="number"
                min={0}
                max={10080}
                required
                value={config.warningMinutes}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    warningMinutes: Number(event.target.value),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                0 để tắt; thời gian cảnh báo cũng tính theo lịch SLA.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sla-escalation">Khi quá hạn</Label>
              <select
                id="sla-escalation"
                className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
                value={config.escalation}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    escalation: event.target
                      .value as SlaPolicyConfig["escalation"],
                  })
                }
              >
                <option value="ADMINS_AND_MANAGER">
                  Thông báo ADMIN và quản lý người xử lý
                </option>
                <option value="ADMINS">Chỉ thông báo ADMIN</option>
                <option value="NONE">Không chuyển cấp</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Giữ nguyên người phụ trách ticket. Quản lý nhận chuyển cấp có
                quyền đọc và bình luận ticket đó.
              </p>
            </div>
          </CardContent>
        </Card>
      </fieldset>
      {error ? (
        <div
          role="alert"
          className="grid gap-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
        >
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={onReload}
          >
            Tải lại cấu hình đã lưu
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Chỉ áp dụng cho ticket tạo sau khi lưu. Hạn của ticket cũ được giữ
          nguyên.
        </p>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Đang lưu..." : "Lưu chính sách SLA"}
        </Button>
      </div>
    </form>
  );
}

export default function SlaPolicyPage() {
  const { data: user } = useMe();
  const policy = useSlaPolicy(user?.role === "ADMIN");
  const [saved, setSaved] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  if (user?.role !== "ADMIN") return <p>Bạn không có quyền cấu hình SLA.</p>;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Chính sách SLA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quản lý lịch làm việc và thời hạn hỗ trợ nội bộ.
        </p>
      </div>
      {saved ? (
        <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">
          Đã lưu chính sách SLA cho các ticket mới.
        </p>
      ) : null}
      {policy.isLoading ? (
        <p>Đang tải chính sách...</p>
      ) : policy.isError ? (
        <div role="alert">
          <p>
            {getApiErrorMessage(policy.error, "Không thể tải chính sách SLA.")}
          </p>
          <Button variant="outline" onClick={() => policy.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : policy.data ? (
        <PolicyForm
          key={`${policy.data.version}:${reloadCount}`}
          policy={policy.data}
          onSaved={() => setSaved(true)}
          onReload={() => {
            setSaved(false);
            setReloadCount((count) => count + 1);
            void policy.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
