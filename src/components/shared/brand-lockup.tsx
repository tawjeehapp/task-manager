"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type BrandLockupProps = {
  href?: string;
  onNavigate?: () => void;
  className?: string;
  /** Compact for header; default is sidebar-sized. */
  size?: "sm" | "md";
  /** Light text for dark teal sidebar; dark text for light header. */
  tone?: "onDark" | "onLight";
};

export function BrandLockup({
  href = "/",
  onNavigate,
  className,
  size = "md",
  tone = "onLight",
}: BrandLockupProps) {
  const t = useTranslations("app");
  const logoPx = size === "sm" ? 48 : 40;
  const logoClass = size === "sm" ? "size-12" : "size-10";
  const companyClass =
    tone === "onDark" ? "text-sidebar-primary" : "text-accent-muted";
  const appClass =
    tone === "onDark" ? "text-sidebar-foreground" : "text-primary";

  const content = (
    <>
      <Image
        src="/brand/logo.png"
        alt=""
        width={logoPx}
        height={logoPx}
        className={cn("shrink-0 object-contain", logoClass)}
        priority
      />
      <span className="min-w-0 text-start">
        <span
          className={cn(
            "block truncate text-xs font-medium tracking-wide",
            companyClass,
          )}
        >
          {t("companyName")}
        </span>
        <span
          className={cn(
            "block truncate text-sm font-semibold tracking-tight",
            appClass,
          )}
        >
          {t("shortName")}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn("flex min-w-0 items-center gap-3", className)}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {content}
    </div>
  );
}
