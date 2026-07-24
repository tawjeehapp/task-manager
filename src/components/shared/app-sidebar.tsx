"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { navSections } from "@/components/shared/nav-config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex h-14 items-center px-4">
        <Link
          href="/"
          className="truncate text-sm font-semibold tracking-tight"
          onClick={onNavigate}
        >
          {tApp("name")}
        </Link>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {navSections.map((section) => (
            <div key={section.key} className="space-y-2">
              <p className="px-2 text-xs font-medium text-muted-foreground">
                {t(section.key)}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const label = t(item.key);
                  const isActive = item.enabled && pathname === item.href;

                  if (!item.enabled) {
                    return (
                      <li key={item.key}>
                        <span
                          className="flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground/70"
                          aria-disabled="true"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{label}</span>
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          isActive &&
                            "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
