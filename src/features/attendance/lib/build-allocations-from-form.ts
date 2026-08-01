export type FormTaskRow = {
  taskId: string;
  hours: string;
};

export type BuiltTaskAllocation = {
  type: "task";
  taskId: string;
  hours: number;
};

export type BuiltGeneralAllocation = {
  type: "general";
  reason: string;
  hours: number;
};

export type BuiltAllocation = BuiltTaskAllocation | BuiltGeneralAllocation;

export type BuildAllocationsResult =
  | { ok: true; allocations: BuiltAllocation[]; remainingHours: number }
  | {
      ok: false;
      code:
        | "over_allocated"
        | "reason_required"
        | "incomplete_task_row"
        | "duplicate_task"
        | "empty";
      remainingHours: number;
    };

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Builds submit allocations from task rows + auto general remainder.
 * Leftover net − Σ(task hours) becomes one general row when > 0.
 */
export function buildAllocationsFromForm(input: {
  taskRows: FormTaskRow[];
  netHours: number;
  remainderReason: string;
}): BuildAllocationsResult {
  const { taskRows, netHours, remainderReason } = input;

  const incomplete = taskRows.some((row) => {
    const hasTask = Boolean(row.taskId);
    const hours = Number(row.hours);
    const hasHours = Number.isFinite(hours) && hours > 0;
    // Empty rows (no task, no hours) are ignored
    if (!hasTask && !hasHours) return false;
    return !hasTask || !hasHours;
  });
  if (incomplete) {
    return { ok: false, code: "incomplete_task_row", remainingHours: 0 };
  }

  const filled = taskRows.filter((row) => {
    const hours = Number(row.hours);
    return Boolean(row.taskId) && Number.isFinite(hours) && hours > 0;
  });

  const taskIds = filled.map((row) => row.taskId);
  if (new Set(taskIds).size !== taskIds.length) {
    return { ok: false, code: "duplicate_task", remainingHours: 0 };
  }

  const taskAllocations: BuiltTaskAllocation[] = filled.map((row) => ({
    type: "task",
    taskId: row.taskId,
    hours: Number(row.hours),
  }));

  const taskHours = roundHours(
    taskAllocations.reduce((sum, row) => sum + row.hours, 0),
  );
  const remainingHours = roundHours(netHours - taskHours);

  if (remainingHours < 0) {
    return { ok: false, code: "over_allocated", remainingHours };
  }

  if (remainingHours > 0) {
    const reason = remainderReason.trim();
    if (reason.length < 2) {
      return { ok: false, code: "reason_required", remainingHours };
    }
    return {
      ok: true,
      remainingHours,
      allocations: [
        ...taskAllocations,
        { type: "general", reason, hours: remainingHours },
      ],
    };
  }

  if (taskAllocations.length === 0) {
    return { ok: false, code: "empty", remainingHours: 0 };
  }

  return { ok: true, allocations: taskAllocations, remainingHours: 0 };
}

export function initialTaskRowsFromAllocations(
  allocations:
    | Array<
        | { type: "task"; taskId: string; hours: number; title?: string }
        | { type: "general"; reason: string; hours: number }
      >
    | undefined,
): { rows: Array<{ taskId: string; hours: string; title?: string }>; remainderReason: string } {
  if (!allocations?.length) {
    return { rows: [{ taskId: "", hours: "" }], remainderReason: "" };
  }

  const taskRows = allocations
    .filter(
      (row): row is { type: "task"; taskId: string; hours: number; title?: string } =>
        row.type === "task",
    )
    .map((row) => ({
      taskId: row.taskId,
      hours: String(row.hours),
      title: row.title,
    }));

  const generalReasons = allocations
    .filter(
      (row): row is { type: "general"; reason: string; hours: number } =>
        row.type === "general",
    )
    .map((row) => row.reason.trim())
    .filter(Boolean);

  return {
    rows: taskRows.length > 0 ? taskRows : [{ taskId: "", hours: "" }],
    remainderReason: generalReasons.join("; "),
  };
}
