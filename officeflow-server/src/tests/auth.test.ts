import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";

describe("Auth API", () => {
  it("POST /api/auth/login should return 422 when body is invalid", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "invalid-email",
      password: "123",
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  it("POST /api/auth/login should return 401 with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@officeflow.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid email or password");
  });
});
