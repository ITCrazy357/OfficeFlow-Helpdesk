import { test, expect, type Page } from "@playwright/test";

const longCategory =
  "Kết nối mạng và quyền truy cập hệ thống nội bộ cho toàn bộ nhân viên làm việc từ xa tại văn phòng";
const me = {
  id: 1,
  name: "Quản trị kiểm thử",
  email: "admin@example.test",
  role: "ADMIN",
  isActive: true,
  isLocked: false,
  mustChangePassword: false,
  departmentId: 1,
  createdAt: "2026-01-01T00:00:00Z",
  department: { id: 1, name: "Vận hành" },
};
const pagination = { page: 1, limit: 10, totalItems: 0, totalPages: 1 };

async function fixtureApi(page: Page) {
  await page.route("**/backend-api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace(
      "/backend-api",
      "",
    );
    let data: unknown;
    if (endpoint === "/auth/refresh") data = { accessToken: "browser-fixture" };
    else if (endpoint === "/auth/me") data = me;
    else if (endpoint === "/ticket-categories")
      data = [
        { id: 1, name: longCategory, isActive: true },
        { id: 2, name: "Hardware", isActive: true },
      ];
    else if (endpoint === "/departments")
      data = [
        { id: 1, name: "Vận hành" },
        { id: 2, name: longCategory },
      ];
    else if (endpoint === "/users")
      data = [
        me,
        {
          ...me,
          id: 2,
          role: "MANAGER",
          name: "Người quản lý kiểm thử",
          email: "manager@example.test",
        },
      ];
    else if (endpoint === "/notifications/unread-count") data = 0;
    else if (
      ["/knowledge", "/notifications", "/audit-logs", "/assets"].includes(
        endpoint,
      )
    )
      data = { items: [], pagination };
    else if (endpoint === "/assets/my") data = [];
    else if (endpoint.startsWith("/leave-request/"))
      data = { items: [], pagination };
    else if (endpoint === "/sla/policy")
      data = {
        version: 1,
        updatedAt: null,
        config: {
          mode: "BUSINESS",
          timezone: "Asia/Ho_Chi_Minh",
          workingDays: [1, 2, 3, 4, 5],
          workingHours: [{ start: "08:00", end: "17:00" }],
          holidays: [],
          targets: Object.fromEntries(
            ["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => [
              priority,
              { responseMinutes: 60, resolutionMinutes: 480 },
            ]),
          ),
          warningMinutes: 30,
          escalation: "NONE",
        },
      };
    else
      return route.fulfill({
        status: 404,
        json: { message: `Missing UI fixture: ${endpoint}` },
      });
    await route.fulfill({
      json: { success: true, message: "Browser fixture", data },
    });
  });
}

async function visit(page: Page, pathname: string) {
  await page.goto(pathname);
  await page.waitForLoadState("networkidle");
}

/** Measure actual controls; a no-overflow check cannot detect uneven grid tracks. */
async function expectFieldAlignment(page: Page) {
  const issues = await page.evaluate(() => {
    const issues: string[] = [];
    const groups = new Map<
      Element,
      Array<{ label: string; x: number; y: number; controlY: number }>
    >();
    for (const label of document.querySelectorAll<HTMLLabelElement>(
      "[data-slot=label]",
    )) {
      const field = label.parentElement;
      if (
        !field ||
        getComputedStyle(field).display !== "grid" ||
        !label.checkVisibility()
      )
        continue;
      const control = field.querySelector<HTMLElement>(
        "[data-slot=input], [data-slot=select-trigger], [data-slot=textarea], select",
      );
      if (!control || !control.checkVisibility()) continue;
      if (label.htmlFor && label.control !== control)
        issues.push(`Unbound label: ${label.textContent}`);
      const row = field.parentElement;
      if (!row || getComputedStyle(row).display !== "grid") continue;
      const rect = control.getBoundingClientRect();
      const group = groups.get(row) ?? [];
      group.push({
        label: label.textContent ?? "",
        x: rect.x,
        y: label.getBoundingClientRect().top,
        controlY: rect.top,
      });
      groups.set(row, group);
    }
    for (const fields of groups.values()) {
      for (let i = 1; i < fields.length; i++) {
        const a = fields[i - 1],
          b = fields[i];
        if (
          Math.abs(a.x - b.x) > 20 &&
          Math.abs(a.y - b.y) < 40 &&
          Math.abs(a.controlY - b.controlY) > 1
        ) {
          issues.push(`${a.label} / ${b.label}: ${a.controlY} / ${b.controlY}`);
        }
      }
    }
    return issues;
  });
  expect(issues, "Labels and controls in the same form row must align").toEqual(
    [],
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [1724, 768, 390, 320]) {
    test.describe(`${theme}, ${width}px`, () => {
      test.use({ viewport: { width, height: 1000 } });
      test.beforeEach(async ({ page }) => {
        await fixtureApi(page);
        await page.addInitScript(
          (value) => localStorage.setItem("officeflow-theme", value),
          theme,
        );
      });

      test("ticket fields remain aligned with hints and a long selected category", async ({
        page,
      }) => {
        await visit(page, "/tickets/new");
        await expectFieldAlignment(page);
        await expect(
          page.getByRole("combobox", { name: "Độ ưu tiên", exact: true }),
        ).toBeVisible();
        const priority = page.getByRole("combobox", {
          name: "Độ ưu tiên",
          exact: true,
        });
        await priority.focus();
        await page.keyboard.press("Space");
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        await expect(priority).toContainText("Khẩn cấp");
        const category = page.getByRole("combobox", {
          name: "Danh mục",
          exact: true,
        });
        await category.click();
        const menu = page.getByRole("listbox");
        await expect(menu).toBeVisible();
        const rect = await menu.boundingBox();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width + 1);
        await page
          .getByRole("option", { name: longCategory, exact: true })
          .click();
        await expect(category).toContainText(longCategory);
        await expectFieldAlignment(page);
        const bounds = await category.evaluate((el) => ({
          trigger: el.getBoundingClientRect().right,
          icon: el.querySelector("svg")!.getBoundingClientRect().right,
        }));
        expect(bounds.icon).toBeLessThan(bounds.trigger);
        await page
          .getByRole("button", { name: "Tạo ticket", exact: true })
          .click();
        await expect(page.locator("#ticket-title")).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        await expectFieldAlignment(page);
      });

      test("asset, leave, knowledge and user fields stay aligned after validation", async ({
        page,
      }) => {
        await visit(page, "/assets/new");
        await expectFieldAlignment(page);
        await page.locator("form button[type=submit]").click();
        await expect(page.locator("#asset-tag")).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        await expectFieldAlignment(page);
        await visit(page, "/leave-requests/new");
        await expectFieldAlignment(page);
        await page.locator("form button[type=submit]").click();
        await expect(page.locator("#leave-start-date")).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        await expectFieldAlignment(page);
        await visit(page, "/knowledge");
        await page
          .getByRole("button", { name: "Tạo bài viết", exact: true })
          .click();
        await expect(page.locator("#knowledge-title")).toBeVisible();
        await expectFieldAlignment(page);
        await page.locator("form button[type=submit]").click();
        await expect(page.locator("#knowledge-title")).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        await expectFieldAlignment(page);
        await visit(page, "/users");
        await page
          .getByRole("button", { name: "Tạo tài khoản", exact: true })
          .click();
        await expect(page.locator("#create-user-name")).toBeVisible();
        await expectFieldAlignment(page);
        await page.locator("form button[type=submit]").click();
        await expect(page.locator("#create-user-name")).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        await expectFieldAlignment(page);
      });
    });
  }
}

test("category loading, error and empty states do not stretch the priority field", async ({
  page,
}) => {
  await fixtureApi(page);
  await page.setViewportSize({ width: 1724, height: 1000 });
  for (const state of ["loading", "error", "empty"]) {
    await page.route("**/backend-api/ticket-categories", async (route) => {
      if (state === "loading")
        await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill(
        state === "error"
          ? { status: 503, json: { message: "Temporary category failure" } }
          : { json: { success: true, data: [] } },
      );
    });
    await page.goto("/tickets/new");
    if (state === "loading")
      await expect(
        page.getByText("Đang tải danh mục...", { exact: true }),
      ).toBeVisible();
    else
      await expect(
        page.getByText(
          state === "error" ? "Không thể tải danh mục." : "Chưa có danh mục",
          { exact: true },
        ),
      ).toBeVisible();
    const gap = await page.locator("#ticket-priority").evaluate((control) => {
      const label = document.getElementById("ticket-priority-label")!;
      return (
        control.getBoundingClientRect().top -
        label.getBoundingClientRect().bottom
      );
    });
    expect(gap).toBe(8);
  }
});

test("long unbroken options wrap inside the menu and keep the trigger arrow visible", async ({
  page,
}) => {
  await fixtureApi(page);
  const identifier = `VPN-${"x".repeat(160)}`;
  await page.route("**/backend-api/ticket-categories", (route) =>
    route.fulfill({
      json: { success: true, data: [{ id: 1, name: identifier }] },
    }),
  );
  await page.setViewportSize({ width: 320, height: 1000 });
  await visit(page, "/tickets/new");
  const trigger = page.getByRole("combobox", { name: "Danh mục", exact: true });
  await trigger.click();
  const option = page.getByRole("option", { name: identifier, exact: true });
  const fits = await option.evaluate((el) => {
    const text = el.querySelector('[data-slot="select-item-text"]')!;
    const range = document.createRange();
    range.selectNodeContents(text);
    return (
      range.getBoundingClientRect().right <= el.getBoundingClientRect().right
    );
  });
  expect(fits).toBe(true);
  await option.click();
  await expect(trigger).toContainText(identifier);
  expect(
    await trigger.evaluate(
      (el) =>
        el.querySelector("svg")!.getBoundingClientRect().right <
        el.getBoundingClientRect().right,
    ),
  ).toBe(true);
  await expectFieldAlignment(page);
});
