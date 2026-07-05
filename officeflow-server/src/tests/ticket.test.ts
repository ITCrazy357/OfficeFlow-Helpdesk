import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";

describe("Ticket API", () => {
  it("POST /api/tickets should return 422 when title is missing", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@officeflow.com",
      password: "123456",
    });

    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        description: "This description is valid but title is missing.",
        priority: "HIGH",
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  it("GET /api/tickets/999999 should return 404", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@officeflow.com",
      password: "123456",
    });

    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .get("/api/tickets/999999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Ticket not found");
  });
});
