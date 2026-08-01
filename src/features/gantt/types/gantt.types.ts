export type GanttTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
  barStart: string;
  barEnd: string;
  progressPercentage: number;
  overdue: boolean;
};

export type GanttDependency = {
  taskId: string;
  dependsOnTaskId: string;
};

export type ProjectGanttResult = {
  projectId: string;
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  rangeStart: string;
  rangeEnd: string;
};
