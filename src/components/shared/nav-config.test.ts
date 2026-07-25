import { describe, expect, it } from "vitest";

import { navItemIsVisible, navSections } from "@/components/shared/nav-config";

describe("navItemIsVisible", () => {
  it("hides reports and settings from employees", () => {
    const reports = navSections
      .flatMap((section) => section.items)
      .find((item) => item.key === "reports");
    const settings = navSections
      .flatMap((section) => section.items)
      .find((item) => item.key === "settings");

    expect(reports).toBeDefined();
    expect(settings).toBeDefined();
    expect(navItemIsVisible(reports!, [], "employee")).toBe(false);
    expect(navItemIsVisible(settings!, [], "employee")).toBe(false);
  });

  it("still shows reports and settings placeholders to admins", () => {
    const reports = navSections
      .flatMap((section) => section.items)
      .find((item) => item.key === "reports");
    const settings = navSections
      .flatMap((section) => section.items)
      .find((item) => item.key === "settings");

    expect(navItemIsVisible(reports!, [], "admin")).toBe(true);
    expect(navItemIsVisible(settings!, [], "admin")).toBe(true);
  });
});
