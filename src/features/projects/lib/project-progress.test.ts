import { describe, expect, it } from "vitest";

import { computeHoursWeightedProgress } from "@/features/projects/lib/project-progress";

describe("computeHoursWeightedProgress", () => {
  it("returns 0 for an empty project", () => {
    expect(computeHoursWeightedProgress([])).toBe(0);
  });

  it("returns 0 when total hours are non-positive", () => {
    expect(
      computeHoursWeightedProgress([
        { status: "completed", estimatedHours: 0 },
      ]),
    ).toBe(0);
  });

  it("matches count-based percent when hours are equal", () => {
    expect(
      computeHoursWeightedProgress([
        { status: "completed", estimatedHours: 2 },
        { status: "todo", estimatedHours: 2 },
      ]),
    ).toBe(50);
  });

  it("weights by estimated hours", () => {
    expect(
      computeHoursWeightedProgress([
        { status: "completed", estimatedHours: 1 },
        { status: "todo", estimatedHours: 9 },
      ]),
    ).toBe(10);
  });

  it("treats incomplete statuses as zero contribution", () => {
    expect(
      computeHoursWeightedProgress([
        { status: "in_progress", estimatedHours: 8 },
        { status: "blocked", estimatedHours: 2 },
      ]),
    ).toBe(0);
  });

  it("returns 100 when all tasks are completed", () => {
    expect(
      computeHoursWeightedProgress([
        { status: "completed", estimatedHours: 3 },
        { status: "completed", estimatedHours: 7 },
      ]),
    ).toBe(100);
  });
});
