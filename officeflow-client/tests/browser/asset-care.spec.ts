import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page, role = "ADMIN") {
  const asset = {
    id: 5,
    assetTag: "LAP-5",
    name: "Laptop kiểm thử",
    type: "LAPTOP",
    status: "AVAILABLE",
    assignedToId: null,
    supplierName: "Nhà cung cấp A",
    supplierContact: "0123456789",
    warrantyUntil: "2026-11-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    tickets: [],
    _count: { assignments: 0, tickets: 0 },
  };
  type MaintenanceFixture = {
    id: number;
    title: string;
    kind: string;
    status: string;
    scheduledFor: string;
    vendor: string | null;
    cost: string | null;
    notes: string | null;
    version: number;
    performedOn: string | null;
  };
  const state = {
    records: [] as MaintenanceFixture[],
    writes: [] as { path: string; input: Record<string, unknown> }[],
    careRequests: 0,
    listQueries: [] as string[],
    conflict: false,
    readFailure: 0,
  };
  await page.route(/\/(?:backend-api|api)\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/(?:backend-api|api)/, "");
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3016",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const fail = (status: number, message: string) =>
      route.fulfill({ status, headers, json: { message } });
    let data: unknown = [];
    if (path === "/auth/refresh") data = { accessToken: "asset-care-fixture" };
    else if (path === "/auth/me")
      data = {
        id: 1,
        name: "Kiểm thử",
        email: "user@example.test",
        role,
        isActive: true,
        isLocked: false,
        mustChangePassword: false,
      };
    else if (path === "/notifications/unread-count") data = 0;
    else if (path === "/assets/care-overview") {
      state.careRequests++;
      data = {
        today: "2026-10-18",
        reminderDays: 30,
        warrantySoon: 1,
        warrantyExpired: 0,
        maintenanceDue: state.records.filter((row) => row.status === "PLANNED")
          .length,
        warrantyAssets: [asset],
        maintenances: state.records
          .filter((row) => row.status === "PLANNED")
          .map((row) => ({ ...row, assetId: 5, asset })),
      };
    } else if (path === "/assets/5/maintenance" && request.method() === "GET") {
      state.careRequests++;
      if (state.readFailure)
        return fail(state.readFailure, "Lỗi tải lịch sử bảo trì");
      const status = url.searchParams.get("status");
      const rows = state.records.filter(
        (row) => !status || row.status === status,
      );
      data = {
        items: rows,
        pagination: {
          page: 1,
          limit: 10,
          totalItems: rows.length,
          totalPages: rows.length ? 1 : 0,
        },
      };
    } else if (
      path.startsWith("/assets/5/maintenance") &&
      request.method() !== "GET"
    ) {
      const input = request.postDataJSON();
      state.writes.push({ path, input });
      if (request.method() === "POST") {
        const record = {
          id: state.records.length + 1,
          ...input,
          status: "PLANNED",
          version: 0,
          cost: null,
          performedOn: null,
        };
        state.records.unshift(record);
        data = record;
      } else {
        const record = state.records.find(
          (row) => row.id === Number(path.split("/")[4]),
        )!;
        if (state.conflict) {
          state.conflict = false;
          record.version++;
          record.title = "Lịch đã được người khác sửa";
          return fail(409, "Maintenance record changed. Reload before saving");
        }
        if (record.version !== input.version)
          return fail(409, "Maintenance record changed. Reload before saving");
        Object.assign(record, input, { version: record.version + 1 });
        if (path.endsWith("/complete")) record.status = "COMPLETED";
        if (path.endsWith("/cancel")) record.status = "CANCELLED";
        data = record;
      }
    } else if (path === "/assets/5")
      data = {
        ...asset,
        status: role === "EMPLOYEE" ? "ASSIGNED" : asset.status,
        assignedToId: role === "EMPLOYEE" ? 1 : null,
      };
    else if (path === "/assets") {
      state.listQueries.push(url.search);
      data = {
        items: [asset],
        pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
      };
    } else if (path === "/assets/my") data = [asset];
    else if (path === "/notifications")
      data = {
        items: [],
        pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
      };
    await route.fulfill({ headers, json: { success: true, data } });
  });
  return state;
}

async function createSchedule(page: Page, title = "Thay quạt tản nhiệt") {
  const form = page.getByRole("form", {
    name: "Lập lịch bảo trì",
    exact: true,
  });
  await form.getByLabel("Nội dung", { exact: true }).fill(title);
  await form.getByLabel("Loại công việc").selectOption("REPAIR");
  await form.getByLabel("Ngày dự kiến").fill("2026-10-18");
  await form.getByRole("button", { name: "Tạo lịch", exact: true }).click();
  await expect(
    page.getByText("Đã lưu lịch bảo trì.", { exact: true }),
  ).toBeVisible();
}

test("scheduling, rescheduling, VND completion and cancellation preserve history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await fixture(page);
  await page.goto("/assets/5");
  await createSchedule(page);
  let record = page
    .getByRole("listitem")
    .filter({ hasText: "Thay quạt tản nhiệt" });
  await record.getByRole("button", { name: "Sửa lịch", exact: true }).click();
  const edit = page.getByRole("form", { name: "Chỉnh lịch bảo trì" });
  await edit.getByLabel("Ngày dự kiến").fill("2026-10-20");
  await edit.getByRole("button", { name: "Lưu lịch đã sửa" }).click();
  expect(state.writes.at(-1)?.input.version).toBe(0);
  await expect(record).toContainText("2026-10-20");
  await record
    .getByRole("button", { name: "Ghi nhận hoàn tất", exact: true })
    .click();
  const complete = page.getByRole("form", {
    name: "Ghi nhận hoàn tất",
    exact: true,
  });
  await complete.getByLabel("Chi phí thực tế (VND)").fill("1250000");
  await complete
    .getByLabel("Kết quả và ghi chú")
    .fill("<script>window.__maintenanceExecuted = true</script>");
  await complete.getByRole("button", { name: "Xác nhận hoàn tất" }).click();
  await expect(record).toContainText("1.250.000");
  await expect(record.getByRole("button")).toHaveCount(0);
  expect(state.writes.at(-1)?.input).toMatchObject({
    version: 1,
    cost: "1250000",
  });
  await createSchedule(page, "Vệ sinh định kỳ");
  record = page.getByRole("listitem").filter({ hasText: "Vệ sinh định kỳ" });
  await record.getByRole("button", { name: "Hủy lịch", exact: true }).click();
  await expect(record).toContainText("Đã hủy");
  await page
    .getByRole("combobox", { name: "Lọc lịch sử", exact: true })
    .selectOption("COMPLETED");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Vệ sinh định kỳ" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__maintenanceExecuted,
    ),
  ).toBeUndefined();
  expect(errors).toEqual([]);
});

test("conflicts keep the draft while refreshing history; missing costs stay unknown", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/assets/5");
  await createSchedule(page);
  await page.getByRole("button", { name: "Sửa lịch", exact: true }).click();
  const edit = page.getByRole("form", { name: "Chỉnh lịch bảo trì" });
  await edit.getByLabel("Nội dung", { exact: true }).fill("Bản sửa chưa lưu");
  state.conflict = true;
  await edit.getByRole("button", { name: "Lưu lịch đã sửa" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Reload" }),
  ).toBeVisible();
  await expect(edit.getByLabel("Nội dung", { exact: true })).toHaveValue(
    "Bản sửa chưa lưu",
  );
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Lịch đã được người khác sửa" }),
  ).toBeVisible();
  await edit.getByRole("button", { name: "Bỏ chỉnh sửa" }).click();
  await page
    .getByRole("button", { name: "Ghi nhận hoàn tất", exact: true })
    .click();
  const complete = page.getByRole("form", {
    name: "Ghi nhận hoàn tất",
    exact: true,
  });
  await complete.getByRole("button", { name: "Xác nhận hoàn tất" }).click();
  await expect(page.getByText(/Chi phí: Chưa ghi nhận/)).toBeVisible();
  expect(state.writes.at(-1)?.input.cost).toBeNull();
});

test("care overview and warranty filter navigate to the asset", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/assets");
  const overview = page.getByRole("region", {
    name: "Tổng quan bảo trì và bảo hành",
  });
  await expect(
    overview.getByText("Sắp hết bảo hành", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Lọc bảo hành", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Sắp hết trong 30 ngày", exact: true })
    .click();
  await expect
    .poll(() => state.listQueries.at(-1))
    .toContain("warranty=EXPIRING");
  await overview.getByRole("link", { name: /LAP-5/ }).click();
  await expect(
    page.getByRole("form", { name: "Lập lịch bảo trì", exact: true }),
  ).toBeVisible();
});

test("employees do not request or see management history and costs", async ({
  page,
}) => {
  const state = await fixture(page, "EMPLOYEE");
  await page.goto("/assets/5");
  await expect(
    page.getByRole("heading", { name: "Laptop kiểm thử", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bảo trì và lịch sử sửa chữa", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/assets");
  await expect(
    page.getByRole("heading", { name: "Tài sản của tôi", exact: true }),
  ).toBeVisible();
  expect(state.careRequests).toBe(0);
});

test("maintenance forms fit mobile and desktop in both themes", async ({
  page,
}, testInfo) => {
  await fixture(page);
  await page.goto("/assets/5");
  await createSchedule(page);
  await page
    .getByRole("button", { name: "Ghi nhận hoàn tất", exact: true })
    .click();
  for (const dark of [false, true]) {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle("dark", value),
      dark,
    );
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const form = page.getByRole("form", {
        name: "Ghi nhận hoàn tất",
        exact: true,
      });
      await form.screenshot({
        path: testInfo.outputPath(
          `asset-care-${dark ? "dark" : "light"}-${width}.png`,
        ),
      });
    }
  }
});
