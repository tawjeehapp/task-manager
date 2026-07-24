import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
} from "lucide-react";

export type NavItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
};

export type NavSection = {
  key: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    key: "main",
    items: [
      {
        key: "dashboard",
        href: "/",
        icon: LayoutDashboard,
        enabled: true,
      },
      {
        key: "projects",
        href: "#",
        icon: FolderKanban,
        enabled: false,
      },
      {
        key: "tasks",
        href: "#",
        icon: ClipboardList,
        enabled: false,
      },
    ],
  },
  {
    key: "organization",
    items: [
      {
        key: "departments",
        href: "#",
        icon: Building2,
        enabled: false,
      },
      {
        key: "employees",
        href: "#",
        icon: Users,
        enabled: false,
      },
    ],
  },
  {
    key: "operations",
    items: [
      {
        key: "attendance",
        href: "#",
        icon: CalendarCheck,
        enabled: false,
      },
    ],
  },
  {
    key: "communication",
    items: [
      {
        key: "announcements",
        href: "#",
        icon: Megaphone,
        enabled: false,
      },
      {
        key: "notifications",
        href: "#",
        icon: Bell,
        enabled: false,
      },
    ],
  },
  {
    key: "analytics",
    items: [
      {
        key: "reports",
        href: "#",
        icon: FileText,
        enabled: false,
      },
    ],
  },
  {
    key: "administration",
    items: [
      {
        key: "settings",
        href: "#",
        icon: Settings,
        enabled: false,
      },
    ],
  },
];

export const mobileNavItems: NavItem[] = [
  {
    key: "dashboard",
    href: "/",
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    key: "projects",
    href: "#",
    icon: FolderKanban,
    enabled: false,
  },
  {
    key: "tasks",
    href: "#",
    icon: ClipboardList,
    enabled: false,
  },
  {
    key: "notifications",
    href: "#",
    icon: Bell,
    enabled: false,
  },
];
