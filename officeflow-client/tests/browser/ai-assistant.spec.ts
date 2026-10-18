import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page, role = "IT_STAFF") {
  const me = {
    id: 1,
    name: "Kiểm thử",
    email: "staff@example.test",
    role,
    isActive: true,
    isLocked: false,
    mustChangePassword: false,
  };
  const state = {
    enabled: true,
    fail: false,
    aiRequests: 0,
    writes: [] as Array<{ path: string; input: Record<string, unknown> }>,
    generations: [] as string[],
  };
  const ticket = {
    id: 5,
    title: "Sửa kết nối VPN",
    description: "Không truy cập được mạng nội bộ",
    status: "RESOLVED",
    priority: "MEDIUM",
    createdBy: { ...me, id: 2, role: "EMPLOYEE" },
    assignedTo: me,
    resolutionVersion: 1,
    resolveAt: "2026-10-18T08:00:00Z",
    createdAt: "2026-10-18T07:00:00Z",
    updatedAt: "2026-10-18T08:00:00Z",
    category: null,
    asset: null,
  };
  await page.route(/\/(?:backend-api|api)\//, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(
      /^.*\/(?:backend-api|api)/,
      "",
    );
    let data: unknown = [];
    if (path.startsWith("/ai/")) state.aiRequests++;
    if (path === "/auth/refresh") data = { accessToken: "ai-fixture" };
    else if (path === "/auth/me") data = me;
    else if (path === "/notifications/unread-count") data = 0;
    else if (path === "/tickets/5") data = ticket;
    else if (path === "/tickets/5/feedback") data = null;
    else if (path === "/ai/status")
      data = {
        enabled: state.enabled,
        model: state.enabled ? "test-model" : null,
        reason: state.enabled ? null : "DISABLED",
      };
    else if (path === "/ai/tickets/5/draft") {
      const { task } = req.postDataJSON();
      state.generations.push(task);
      if (state.fail)
        return route.fulfill({
          status: 503,
          json: { message: "AI tạm thời không đáp ứng. Hãy thử lại sau." },
        });
      data = {
        task,
        ticketId: 5,
        title: "Hướng dẫn kiểm tra VPN",
        summary: "Các bước đã được kiểm chứng",
        content:
          task === "ARTICLE"
            ? "Kiểm tra kết nối và đối chiếu cấu hình VPN theo hướng dẫn."
            : "Kiểm tra VPN theo hướng dẫn. <script>alert(1)</script>",
        sourceIds: [7],
        sources: [
          { id: 7, title: "VPN <b>hướng dẫn</b>", updatedAt: ticket.updatedAt },
        ],
        generatedAt: new Date().toISOString(),
        model: "test-model",
        context: { includedComments: 20, totalComments: 30, truncated: true },
      };
    } else if (
      req.method() === "POST" &&
      (path === "/knowledge" || path === "/tickets/5/comments")
    ) {
      const input = req.postDataJSON();
      state.writes.push({ path, input });
      data = {
        id: 19,
        ...input,
        createdBy: me,
        author: me,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      };
    } else if (path === "/notifications")
      data = {
        items: [],
        pagination: { page: 1, totalPages: 0, totalItems: 0, limit: 10 },
      };
    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}

test("reply remains editable, preserves manual text and only sends on explicit comment submit", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/tickets/5");
  const manual = page.locator("#ticket-comment-content");
  await manual.fill("Nội dung IT đang soạn.");
  await page
    .getByRole("button", { name: "Gợi ý phản hồi", exact: true })
    .click();
  const editor = page.getByLabel("Nội dung bản nháp", { exact: true });
  await expect(editor).toHaveValue(/Kiểm tra VPN/);
  expect(state.writes).toEqual([]);
  await expect(
    page.getByRole("link", { name: "VPN <b>hướng dẫn</b>" }),
  ).toHaveAttribute("href", "/knowledge?article=7");
  await expect(page.getByText(/20\/30 bình luận/)).toBeVisible();
  await editor.fill("Bản phản hồi IT đã sửa và kiểm tra.");
  state.fail = true;
  await page
    .getByRole("button", { name: "Gợi ý phản hồi", exact: true })
    .click();
  await expect(page.getByTestId("ticket-ai-assistant").getByRole("alert")).toContainText("AI tạm thời");
  await expect(editor).toHaveValue("Bản phản hồi IT đã sửa và kiểm tra.");
  await page.getByRole("button", { name: "Thêm vào ô bình luận" }).click();
  await expect(manual).toHaveValue(
    "Nội dung IT đang soạn.\n\nBản phản hồi IT đã sửa và kiểm tra.",
  );
  expect(state.writes).toEqual([]);
  await page
    .getByRole("button", { name: "Gửi bình luận", exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toEqual({
    path: "/tickets/5/comments",
    input: {
      content: "Nội dung IT đang soạn.\n\nBản phản hồi IT đã sửa và kiểm tra.",
    },
  });
});

test("article is reviewed and saved as an unpublished draft", async ({
  page,
}) => {
  const state = await fixture(page, "ADMIN");
  await page.goto("/tickets/5");
  await page
    .getByRole("button", { name: "Soạn bài kiến thức", exact: true })
    .click();
  await expect(page.getByLabel("Tiêu đề", { exact: true })).toHaveValue(
    "Hướng dẫn kiểm tra VPN",
  );
  expect(state.writes).toEqual([]);
  await expect(
    page.getByRole("combobox", { name: "Trạng thái", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Tiêu đề", { exact: true })
    .fill("Hướng dẫn VPN đã kiểm tra");
  await page
    .getByRole("button", { name: "Lưu bản nháp kiến thức", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Mở bài kiến thức đã lưu" }),
  ).toHaveAttribute("href", "/knowledge?article=19");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    path: "/knowledge",
    input: { title: "Hướng dẫn VPN đã kiểm tra", isPublished: false },
  });
});

test("disabled AI keeps manual discussion available", async ({ page }) => {
  const state = await fixture(page);
  state.enabled = false;
  await page.goto("/tickets/5");
  await expect(page.getByText(/AI chưa được bật trên máy chủ/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tóm tắt ticket", exact: true }),
  ).toBeDisabled();
  await page
    .locator("#ticket-comment-content")
    .fill("Xử lý thủ công vẫn hoạt động.");
  await page
    .getByRole("button", { name: "Gửi bình luận", exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.generations).toEqual([]);
});

for (const role of ["EMPLOYEE", "MANAGER"]) {
  test(`${role} has no assistant and makes no AI request`, async ({ page }) => {
    const state = await fixture(page, role);
    await page.goto("/tickets/5");
    await expect(
      page.getByText("Mô tả yêu cầu", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("ticket-ai-assistant")).toHaveCount(0);
    expect(state.aiRequests).toBe(0);
  });
}

test("assistant fits mobile and desktop in both themes", async ({ page }) => {
  await fixture(page);
  await page.goto("/tickets/5");
  await page
    .getByRole("button", { name: "Tóm tắt ticket", exact: true })
    .click();
  await expect(
    page.getByLabel("Nội dung bản nháp", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) =>
          document.documentElement.classList.toggle("dark", value === "dark"),
        theme,
      );
      const geometry = await page
        .getByTestId("ticket-ai-assistant")
        .evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            overflow: el.scrollWidth > el.clientWidth + 1,
          };
        });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.overflow).toBe(false);
    }
  }
});
