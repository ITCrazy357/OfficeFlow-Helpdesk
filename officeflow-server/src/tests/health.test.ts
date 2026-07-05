import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";

describe("Health API", () => {
  it("GET /api/health should return API status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("OfficeFlow API is running");
  });
});
