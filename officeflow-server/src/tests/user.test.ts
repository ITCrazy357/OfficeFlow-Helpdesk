import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";

describe("User API", () => {
  it("GET /api/users should return 403 when user is EMPLOYEE", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "levane@gmail.com",
      password: "123456",
    });

    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Forbidden");
  });

  it("GET /api/users should return 200 when user is ADMIN", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@officeflow.com",
      password: "123456",
    });

    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
