import { describe, expect, it } from "vitest";

import {
  createUserSchema,
  phoneNumberSchema,
} from "@/features/users/schemas/user.schema";

describe("phoneNumberSchema", () => {
  it("accepts 09 followed by 8 digits", () => {
    expect(phoneNumberSchema.parse("0912345678")).toBe("0912345678");
  });

  it("rejects invalid formats", () => {
    expect(phoneNumberSchema.safeParse("912345678").success).toBe(false);
    expect(phoneNumberSchema.safeParse("091234567").success).toBe(false);
    expect(phoneNumberSchema.safeParse("0812345678").success).toBe(false);
    expect(phoneNumberSchema.safeParse("09123456789").success).toBe(false);
  });
});

describe("createUserSchema phone", () => {
  it("allows empty phone", () => {
    const parsed = createUserSchema.parse({
      employeeNumber: "1234",
      fullName: "موظف تجريبي",
      phone: "",
      role: "employee",
    });
    expect(parsed.phone).toBeNull();
  });

  it("accepts valid phone", () => {
    const parsed = createUserSchema.parse({
      employeeNumber: "1234",
      fullName: "موظف تجريبي",
      phone: "0912345678",
      role: "employee",
    });
    expect(parsed.phone).toBe("0912345678");
  });
});

describe("createUserSchema weeklyCapacityHours", () => {
  it("defaults weekly capacity to 40", () => {
    const parsed = createUserSchema.parse({
      employeeNumber: "1234",
      fullName: "موظف تجريبي",
      role: "employee",
    });
    expect(parsed.weeklyCapacityHours).toBe(40);
  });

  it("accepts custom weekly capacity", () => {
    const parsed = createUserSchema.parse({
      employeeNumber: "1234",
      fullName: "موظف تجريبي",
      role: "employee",
      weeklyCapacityHours: 32,
    });
    expect(parsed.weeklyCapacityHours).toBe(32);
  });
});
