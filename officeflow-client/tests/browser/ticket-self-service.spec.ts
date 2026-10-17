import { expect, test, type Page } from "@playwright/test";

const guide = {
  id: 7,
  title: "Hướng dẫn VPN",
  slug: "vpn",
  summary: "Các bước kiểm tra VPN.",
  content: "Mở ứng dụng VPN.\n<script>window.__guideExecuted = true</script>",
  isPublished: true,
  tags: "vpn",
  viewCount: 1,
  createdById: 1,
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
};

async function fixture(page: Page) {
  const state = {
    searches: [] as Array<{ title: string; description: string }>,
    tickets: [] as Array<{ title: string; description: string }>,
    failSearch: false,
    denyArticle: false,
    article: { ...guide },
  };
  await page.route(/\/(?:backend-api|api)\//, async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.replace(
      /^.*\/(?:backend-api|api)/,
      "",
    );
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3016",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    let data: unknown = [];
    if (endpoint === "/auth/refresh")
      data = { accessToken: "self-service-fixture" };
    else if (endpoint === "/auth/me")
      data = {
        id: 1,
        name: "Nhân viên kiểm thử",
        email: "employee@example.test",
        role: "EMPLOYEE",
        isActive: true,
        isLocked: false,
        mustChangePassword: false,
        departmentId: 1,
      };
    else if (endpoint === "/notifications/unread-count") data = 0;
    else if (endpoint === "/knowledge/suggest-for-ticket") {
      state.searches.push(request.postDataJSON());
      if (state.failSearch)
        return route.fulfill({
          status: 503,
          headers,
          json: { message: "Gợi ý tạm thời lỗi" },
        });
      data = [state.article];
    } else if (endpoint === `/knowledge/${guide.id}`) {
      if (state.denyArticle)
        return route.fulfill({
          status: 403,
          headers,
          json: { message: "Bài viết đã gỡ xuất bản" },
        });
      data = state.article;
    } else if (endpoint === "/tickets" && request.method() === "POST") {
      state.tickets.push(request.postDataJSON());
      return route.fulfill({
        status: 503,
        headers,
        json: { message: "Kiểm thử gửi ticket thủ công" },
      });
    } else if (endpoint === "/notifications" || endpoint === "/assets")
      data = {
        items: [],
        pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 1 },
      };
    await route.fulfill({ headers, json: { success: true, data } });
  });
  await page.goto("/tickets/new");
  await expect(
    page.getByRole("heading", { name: "Tạo ticket mới", exact: true }),
  ).toBeVisible();
  return state;
}

test("debounced suggestions preserve the full draft and self-resolution prevents a ticket", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await fixture(page);
  expect(state.searches).toHaveLength(0);
  await page.getByLabel("Tiêu đề", { exact: true }).fill("VPN");
  const description = "x".repeat(6000);
  await page.getByLabel("Mô tả", { exact: true }).fill(description);
  await page.getByRole("button", { name: guide.title, exact: true }).click();
  expect(state.searches).toHaveLength(1);
  expect(state.searches[0].description).toHaveLength(5000);
  await expect(page.getByRole("heading", { name: guide.title })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__guideExecuted,
    ),
  ).toBeUndefined();
  await page
    .getByRole("button", { name: "Đã giải quyết", exact: true })
    .click();
  await expect(
    page.getByText("Vấn đề đã được giải quyết", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo ticket", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Tiêu đề", { exact: true }).press("Enter");
  await page
    .locator("form")
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.waitForTimeout(200);
  expect(state.tickets).toHaveLength(0);
  await expect(page.getByLabel("Mô tả", { exact: true })).toHaveValue(
    description,
  );
  await page.getByRole("button", { name: "Vẫn cần hỗ trợ" }).click();
  await page.getByRole("button", { name: "Tạo ticket", exact: true }).click();
  await expect(page.getByText("Kiểm thử gửi ticket thủ công")).toBeVisible();
  expect(state.tickets).toHaveLength(1);
  expect(state.tickets[0].description).toBe(description);
  expect(errors).toEqual([]);
});

test("editing the issue clears the applicable self-resolution and preview", async ({
  page,
}) => {
  await fixture(page);
  await page.getByLabel("Tiêu đề", { exact: true }).fill("VPN");
  await page.getByRole("button", { name: guide.title, exact: true }).click();
  await page
    .getByRole("button", { name: "Đã giải quyết", exact: true })
    .click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill("Email Outlook");
  await expect(
    page.getByRole("button", { name: "Tạo ticket", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Vấn đề đã được giải quyết", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: guide.title, exact: true }).click();
  await expect(page.getByRole("heading", { name: guide.title })).toBeVisible();
  await page.getByLabel("Mô tả", { exact: true }).fill("Một vấn đề khác");
  await expect(
    page.getByRole("region", { name: "Nội dung hướng dẫn" }),
  ).toHaveCount(0);
});

test("search and article access failures leave manual ticket creation available", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failSearch = true;
  await page.getByLabel("Tiêu đề", { exact: true }).fill("VPN");
  await expect(
    page.getByText("Không thể tải gợi ý. Bạn vẫn có thể gửi ticket."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo ticket", exact: true }),
  ).toBeEnabled();
  state.failSearch = false;
  state.denyArticle = true;
  await page.getByRole("button", { name: "Thử lại gợi ý" }).click();
  await page.getByRole("button", { name: guide.title, exact: true }).click();
  await expect(page.getByText("Bài viết đã gỡ xuất bản")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đã giải quyết", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tạo ticket", exact: true }),
  ).toBeEnabled();
});

test("a description alone finds guides and the preview fits a narrow mobile screen", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 850 });
  const state = await fixture(page);
  state.article.title = "Hướng dẫn " + "VPN".repeat(35);
  state.article.content = "https://example.test/" + "path".repeat(500);
  await page.getByLabel("Mô tả", { exact: true }).fill("Không kết nối VPN");
  await page
    .getByRole("button", { name: state.article.title, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: state.article.title }),
  ).toBeVisible();
  expect(state.searches[0].title).toBe("Không kết nối VPN");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("self-service-mobile.png"),
    fullPage: true,
  });
});

test("a late response for the previous draft cannot replace current suggestions", async ({
  page,
}) => {
  await fixture(page);
  let firstRequestSeen = false;
  let releaseFirst = () => {};
  const firstResponse = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  await page.route(
    /\/(?:backend-api|api)\/knowledge\/suggest-for-ticket$/,
    async (route) => {
      const headers = {
        "Access-Control-Allow-Origin": "http://localhost:3016",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "content-type,authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      };
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      const title = route.request().postDataJSON().title;
      if (title === "VPN slow") {
        firstRequestSeen = true;
        await firstResponse;
        // Axios may have already cancelled this request when the draft changed.
        await route
          .fulfill({ headers, json: { success: true, data: [guide] } })
          .catch(() => {});
      } else {
        await route.fulfill({
          headers,
          json: {
            success: true,
            data: [{ ...guide, id: 8, title: "Hướng dẫn Email" }],
          },
        });
      }
    },
  );
  try {
    await page.getByLabel("Tiêu đề", { exact: true }).fill("VPN slow");
    await expect.poll(() => firstRequestSeen).toBe(true);
    await page.getByLabel("Tiêu đề", { exact: true }).fill("Email");
    await expect(
      page.getByRole("button", { name: "Hướng dẫn Email", exact: true }),
    ).toBeVisible();
    releaseFirst();
    await page.waitForTimeout(150);
    await expect(
      page.getByRole("button", { name: guide.title, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Hướng dẫn Email", exact: true }),
    ).toBeVisible();
  } finally {
    releaseFirst();
  }
});
