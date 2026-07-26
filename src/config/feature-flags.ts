function parseBool(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export const featureFlags = {
  gantt: parseBool(process.env.NEXT_PUBLIC_FEATURE_GANTT),
  kanban: parseBool(process.env.NEXT_PUBLIC_FEATURE_KANBAN),
} as const;
