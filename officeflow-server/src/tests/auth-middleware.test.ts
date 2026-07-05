import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";

describe("Auth Middleware", () => {
  it("GET /api/auth/me should return 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Unauthorized");
  });
});
