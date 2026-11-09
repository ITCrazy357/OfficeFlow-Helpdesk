import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page, failReads = false) {
  const me = {
    id: 1,
    name: "Quản trị kiểm thử",
    email: "admin@example.test",
    role: "ADMIN",
    isActive: true,
    isLocked: false,
    mustChangePassword: false,
    departmentId: 1,
    department: { id: 1, name: "IT" },
  };
  const replacement = {
    ...me,
    id: 3,
    name: "Nhân viên xử lý mới",
    email: "replacement@example.test",
    role: "IT_STAFF",
  };
  const createdAt = "2026-10-18T07:00:00Z";
  const ticket = {
    id: 5,
    title: "Kiểm tra kết nối VPN",
    description: "Không truy cập được mạng nội bộ từ máy tính văn phòng.",
    status: "OPEN",
    priority: "MEDIUM",
    createdBy: { ...me, id: 2, role: "EMPLOYEE" },
    assignedTo: me,
    createdAt,
    updatedAt: createdAt,
    category: null,
    asset: null,
  };
  const comments = [
    {
      id: 1,
      author: me,
      content: "Đã kiểm tra cấu hình ban đầu.",
      createdAt,
    },
  ];
  const history = [
    { id: 1, action: "CREATE", createdAt, user: me },
    { id: 2, action: "COMMENTED", createdAt, user: me },
  ];
  const state = {
    failAssignment: true,
    failComments: failReads,
    failHistory: failReads,
    assignmentAttempts: [] as number[],
    submittedComments: [] as string[],
    unexpectedRequests: [] as string[],
  };

  await page.route("**/backend-api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(
      "/backend-api",
      "",
    );
    const fail = (message: string, status = 503) =>
      route.fulfill({ status, json: { message } });
    let data: unknown;

    if (pathname === "/auth/refresh") data = { accessToken: "ticket-fixture" };
    else if (pathname === "/auth/me") data = me;
    else if (pathname === "/notifications/unread-count") data = 0;
    else if (pathname === "/users") data = [me, replacement];
    else if (pathname === "/tickets/5") data = ticket;
    else if (pathname === "/tickets/5/assign") {
      const { assignedToId } = request.postDataJSON();
      state.assignmentAttempts.push(assignedToId);
      if (state.failAssignment)
        return fail("Không thể giao ticket thử nghiệm.", 409);
      ticket.assignedTo = replacement;
      history.push({ id: 3, action: "ASSIGNED", createdAt, user: me });
      data = ticket;
    } else if (
      pathname === "/tickets/5/comments" &&
      request.method() === "POST"
    ) {
      const { content } = request.postDataJSON();
      state.submittedComments.push(content);
      const comment = { id: 2, content, author: me, createdAt };
      comments.push(comment);
      data = comment;
    } else if (pathname === "/tickets/5/comments") {
      if (state.failComments) return fail("Bình luận đang tạm thời gián đoạn.");
      data = comments;
    } else if (pathname === "/tickets/5/history") {
      if (state.failHistory) return fail("Lịch sử đang tạm thời gián đoạn.");
      data = history;
    } else if (pathname === "/tickets/5/attachments") data = [];
    else if (pathname === "/knowledge/suggest-for-ticket")
      data = [
        {
          id: 7,
          title: "Hướng dẫn kết nối VPN",
          slug: "vpn",
          summary: "Kiểm tra cấu hình trước khi kết nối.",
          tags: "VPN, mạng nội bộ",
          viewCount: 3,
          updatedAt: createdAt,
        },
      ];
    else if (pathname === "/ai/status")
      data = { enabled: false, model: null, reason: "DISABLED" };
    else if (pathname === "/assets" || pathname === "/notifications")
      data = {
        items: [],
        pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
      };
    else {
      state.unexpectedRequests.push(`${request.method()} ${pathname}`);
      return fail(`Missing ticket fixture: ${pathname}`, 404);
    }

    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}

function panel(page: Page, title: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(title, { exact: true }) });
}

test("mobile reassignment preserves the comment draft across failure and success", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixture(page);
  await page.goto("/tickets/5");
  const draft = "Đã đối chiếu kết nối và cần kiểm tra quyền truy cập VPN.";
  const editor = page.locator("#ticket-comment-content");
  await editor.fill(draft);
  const assignment = panel(page, "Gán người xử lý");

  await assignment.getByRole("combobox").click();
  await page.getByRole("option", { name: /Nhân viên xử lý mới/ }).click();
  await expect(
    assignment.getByText("Không thể giao ticket thử nghiệm.", { exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveValue(draft);
  expect(state.assignmentAttempts).toEqual([3]);
  expect(state.submittedComments).toEqual([]);

  state.failAssignment = false;
  await expect(assignment.getByRole("combobox")).toBeEnabled();
  await assignment.getByRole("combobox").click();
  await page.getByRole("option", { name: /Nhân viên xử lý mới/ }).click();
  await expect(assignment.getByRole("combobox")).toContainText(
    "Nhân viên xử lý mới",
  );
  await expect(editor).toHaveValue(draft);
  await expect(
    panel(page, "Lịch sử ticket").getByText("Gán người xử lý", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Gửi bình luận", exact: true })
    .click();
  await expect(editor).toHaveValue("");
  await expect(
    panel(page, "Trao đổi").getByText(draft, { exact: true }),
  ).toBeVisible();
  expect(state.assignmentAttempts).toEqual([3, 3]);
  expect(state.submittedComments).toEqual([draft]);
  await expect(
    panel(page, "Lịch sử ticket").getByText("Bình luận", { exact: true }),
  ).toHaveCount(0);
  expect(state.unexpectedRequests).toEqual([]);
});

test("retrying comments and history preserves the draft and knowledge suggestions", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/tickets/5");
  const discussion = panel(page, "Trao đổi");
  const history = panel(page, "Lịch sử ticket");
  await expect(discussion.getByText("Không thể tải bình luận.")).toBeVisible();
  await expect(history.getByText("Không thể tải lịch sử.")).toBeVisible();
  const editor = page.locator("#ticket-comment-content");
  const draft = "Bản nháp vẫn còn khi tải lại thông tin trao đổi.";
  await editor.fill(draft);

  state.failComments = false;
  state.failHistory = false;
  await discussion
    .getByRole("button", { name: "Thử lại", exact: true })
    .click();
  await history.getByRole("button", { name: "Thử lại", exact: true }).click();

  await expect(
    discussion.getByText("Đã kiểm tra cấu hình ban đầu."),
  ).toBeVisible();
  await expect(history.getByText("Tạo ticket", { exact: true })).toBeVisible();
  await expect(editor).toHaveValue(draft);
  await expect(
    page.getByRole("link", { name: /Hướng dẫn kết nối VPN/ }),
  ).toHaveAttribute("href", "/knowledge?articleId=7");
  expect(state.assignmentAttempts).toEqual([]);
  expect(state.submittedComments).toEqual([]);
  expect(state.unexpectedRequests).toEqual([]);
});
