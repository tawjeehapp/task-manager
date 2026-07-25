export const ANNOUNCEMENT_AUDIENCE_TYPES = ["company", "department"] as const;
export type AnnouncementAudienceType =
  (typeof ANNOUNCEMENT_AUDIENCE_TYPES)[number];

export const ANNOUNCEMENT_PRIORITIES = ["low", "medium", "high"] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export type Announcement = {
  id: string;
  title: string;
  content: string;
  audienceType: AnnouncementAudienceType;
  departmentId: string | null;
  departmentName: string | null;
  priority: AnnouncementPriority;
  publishAt: string;
  expiresAt: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  isActive: boolean;
};
