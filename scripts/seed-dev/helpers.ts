import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ATTENDANCE_TIMEZONE,
  AUTH_EMAIL_DOMAIN,
  type SeedUserDef,
} from "./catalog";

export function toAuthEmail(employeeNumber: string): string {
  return `${employeeNumber}@${AUTH_EMAIL_DOMAIN}`;
}

export function computeTotalHours(
  clockInIso: string,
  clockOutIso: string,
  breakMinutes: number,
): number {
  const start = Date.parse(clockInIso);
  const end = Date.parse(clockOutIso);
  const rawMs = end - start - breakMinutes * 60_000;
  return Math.round((rawMs / 3_600_000) * 100) / 100;
}

export function calendarDateInOrgTimezone(
  instant: Date = new Date(),
  timeZone: string = ATTENDANCE_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("DATE_FORMAT_FAILED");
  }
  return `${year}-${month}-${day}`;
}

/** Shift calendar date by N days in org timezone (approximate via UTC noon). */
export function shiftOrgDate(baseDate: string, dayOffset: number): string {
  const [y, m, d] = baseDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + dayOffset, 12, 0, 0));
  return calendarDateInOrgTimezone(utc);
}

/** Build timestamptz for an org-local wall time on a YYYY-MM-DD date. */
export function orgLocalDateTimeIso(
  date: string,
  hours: number,
  minutes: number,
): string {
  // Asia/Riyadh is UTC+3 year-round (no DST).
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${date}T${hh}:${mm}:00.000+03:00`;
}

export async function deleteByIds(
  admin: SupabaseClient,
  table: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) {
    throw new Error(`Failed deleting ${table}: ${error.message}`);
  }
}

export async function upsertRows(
  admin: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await admin.from(table).upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(`Failed upserting ${table}: ${error.message}`);
  }
}

/**
 * Ensure Auth + profile for a seed user.
 * - Never overwrites an existing Auth password.
 * - New Auth users get password = employee number.
 * - Existing profiles: only update deterministic seed fields (name, phone, role, is_active).
 *   Does NOT touch must_change_password.
 * - Newly created profiles: must_change_password = false for easy QA login.
 */
export async function ensureSeedUser(
  admin: SupabaseClient,
  def: SeedUserDef,
): Promise<{ id: string; created: boolean }> {
  const email = toAuthEmail(def.employeeNumber);

  const { data: existingProfile, error: profileLookupError } = await admin
    .from("users")
    .select("id, auth_user_id")
    .eq("employee_number", def.employeeNumber)
    .maybeSingle();

  if (profileLookupError) {
    throw new Error(
      `Lookup user ${def.employeeNumber}: ${profileLookupError.message}`,
    );
  }

  if (existingProfile) {
    const { error: updateError } = await admin
      .from("users")
      .update({
        full_name: def.fullName,
        phone: def.phone,
        role: def.role,
        is_active: true,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingProfile.id);

    if (updateError) {
      throw new Error(
        `Update user ${def.employeeNumber}: ${updateError.message}`,
      );
    }

    return { id: existingProfile.id, created: false };
  }

  // Find or create Auth user — never reset password if Auth already exists.
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    throw new Error(`List auth users: ${listError.message}`);
  }

  let authUserId = listed.users.find((u) => u.email === email)?.id;
  let createdAuth = false;

  if (!authUserId) {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: def.employeeNumber,
        email_confirm: true,
        user_metadata: {
          employee_number: def.employeeNumber,
          full_name: def.fullName,
        },
      });

    if (createError || !created.user) {
      throw createError ?? new Error(`Auth create failed for ${email}`);
    }
    authUserId = created.user.id;
    createdAuth = true;
  }

  const { data: profile, error: insertError } = await admin
    .from("users")
    .insert({
      auth_user_id: authUserId,
      employee_number: def.employeeNumber,
      full_name: def.fullName,
      email,
      phone: def.phone,
      role: def.role,
      is_active: true,
      must_change_password: false,
    })
    .select("id")
    .single();

  if (insertError || !profile) {
    if (createdAuth) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    throw insertError ?? new Error(`Profile create failed for ${email}`);
  }

  return { id: profile.id, created: true };
}
