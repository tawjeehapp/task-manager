import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="outline" className="mt-2" onClick={onRetry}>
          {retryLabel ?? "إعادة المحاولة"}
        </Button>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
