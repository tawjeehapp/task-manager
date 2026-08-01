export type ProgressTaskInput = {
  status: string;
  estimatedHours: number;
};

/** Hours-weighted share of completed task estimates (0–100, one decimal). */
export function computeHoursWeightedProgress(
  tasks: ProgressTaskInput[],
): number {
  if (tasks.length === 0) return 0;
  const totalHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
  if (totalHours <= 0) return 0;
  const completedHours = tasks
    .filter((task) => task.status === "completed")
    .reduce((sum, task) => sum + task.estimatedHours, 0);
  return Math.round((completedHours / totalHours) * 1000) / 10;
}
