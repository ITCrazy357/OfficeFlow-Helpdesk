import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";

describe("Not Found Middleware", () => {
  it("should return 404 when route does not exist", async () => {
    const res = await request(app).get("/api/abcxyz");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Route GET /api/abcxyz not found");
  });
});
