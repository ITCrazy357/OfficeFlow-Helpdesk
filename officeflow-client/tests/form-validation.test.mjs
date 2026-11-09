import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceLoader } from "./helpers/source-loader.mjs";

test("ticket and knowledge forms reject content exceeding API limits", () => {
  const load = createSourceLoader();
  const { ticketFormSchema } = load("features/tickets/schemas.ts");
  const { knowledgeArticleFormSchema } = load("features/knowledge/schemas.ts");
  const ticket = {
    title: "VPN issue",
    description: "x".repeat(15_000),
    priority: "MEDIUM",
  };
  assert.equal(ticketFormSchema.safeParse(ticket).success, true);
  assert.equal(
    ticketFormSchema.safeParse({
      ...ticket,
      description: `${ticket.description}x`,
    }).success,
    false,
  );
  const article = {
    title: "VPN guide",
    content: ticket.description,
    tags: "x".repeat(1000),
    isPublished: false,
  };
  assert.equal(knowledgeArticleFormSchema.safeParse(article).success, true);
  assert.equal(
    knowledgeArticleFormSchema.safeParse({
      ...article,
      content: `${article.content}x`,
    }).success,
    false,
  );
  assert.equal(
    knowledgeArticleFormSchema.safeParse({
      ...article,
      tags: `${article.tags}x`,
    }).success,
    false,
  );
});

test("leave and asset forms reject impossible calendar dates", () => {
  const load = createSourceLoader();
  const { leaveRequestFormSchema } = load("features/leave-requests/schemas.ts");
  const { assetFormSchema } = load("features/assets/schemas.ts");
  const year = new Date().getFullYear() + 4;
  assert.equal(
    leaveRequestFormSchema.safeParse({
      type: "ANNUAL", period: "FULL_DAY",
      startDate: `${year}-02-30`,
      endDate: `${year}-03-01`,
      reason: "Annual leave",
    }).success,
    false,
  );
  const asset = { assetTag: "LAP-01", name: "Laptop", type: "LAPTOP" };
  assert.equal(
    assetFormSchema.safeParse({ ...asset, purchaseDate: "2028-02-29" }).success,
    true,
  );
  assert.equal(
    assetFormSchema.safeParse({ ...asset, purchaseDate: "2027-02-29" }).success,
    false,
  );
});
