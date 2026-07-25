import { describe, expect, it } from "vitest";

import {
  employeeNumberFromAuthEmail,
  isValidEmployeeNumber,
  toAuthEmail,
} from "@/lib/auth/employee-email";

describe("employee-email", () => {
  it("maps employee number to synthetic email", () => {
    expect(toAuthEmail("0000")).toBe("0000@task-manager.com");
    expect(toAuthEmail("1234")).toBe("1234@task-manager.com");
  });

  it("rejects invalid employee numbers", () => {
    expect(isValidEmployeeNumber("12")).toBe(false);
    expect(isValidEmployeeNumber("abcd")).toBe(false);
    expect(() => toAuthEmail("12")).toThrow();
  });

  it("parses employee number from auth email", () => {
    expect(employeeNumberFromAuthEmail("0421@task-manager.com")).toBe("0421");
    expect(employeeNumberFromAuthEmail("user@other.com")).toBeNull();
  });
});
