import { describe, expect, it } from "vitest";

import { PASSWORD_CHANGE_ALLOWLIST } from "@/lib/auth/password-change-allowlist";

describe("password change allowlist", () => {
  it("includes required auth endpoints", () => {
    expect(PASSWORD_CHANGE_ALLOWLIST).toContain(
      "POST /api/auth/change-password",
    );
    expect(PASSWORD_CHANGE_ALLOWLIST).toContain("POST /api/auth/logout");
    expect(PASSWORD_CHANGE_ALLOWLIST).toContain("GET /api/auth/me");
    expect(PASSWORD_CHANGE_ALLOWLIST).not.toContain("GET /api/users");
  });
});
