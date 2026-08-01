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

/** Next calendar date on or after base that is Sun–Thu (working day). */
export function nextWorkingDayOnOrAfter(baseDate: string): string {
  let cursor = baseDate;
  for (let i = 0; i < 14; i += 1) {
    const [y, m, d] = cursor.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const day = utc.getUTCDay(); // 5 Fri, 6 Sat
    if (day !== 5 && day !== 6) {
      return cursor;
    }
    cursor = shiftOrgDate(cursor, 1);
  }
  return baseDate;
}

/** Count inclusive working days (Fri/Sat excluded). */
export function countWorkingDays(startDate: string, endDate: string): number {
  let count = 0;
  let cursor = startDate;
  while (cursor <= endDate) {
    const [y, m, d] = cursor.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const day = utc.getUTCDay();
    if (day !== 5 && day !== 6) count += 1;
    cursor = shiftOrgDate(cursor, 1);
  }
  return count;
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

/**
 * Delete attendance rows that would collide with seed inserts on
 * (user_id, date) — covers non-seed QA rows and prior date drift leftovers.
 */
export async function deleteAttendanceByUserDates(
  admin: SupabaseClient,
  pairs: readonly { userId: string; date: string }[],
): Promise<void> {
  for (const { userId, date } of pairs) {
    const { error } = await admin
      .from("attendance_records")
      .delete()
      .eq("user_id", userId)
      .eq("date", date);
    if (error) {
      throw new Error(
        `Failed deleting attendance for ${userId} on ${date}: ${error.message}`,
      );
    }
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

function isWeakPasswordError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("password") &&
    (normalized.includes("weak") ||
      normalized.includes("least") ||
      normalized.includes("short") ||
      normalized.includes("characters") ||
      normalized.includes("pwned") ||
      normalized.includes("leaked") ||
      normalized.includes("strength"))
  );
}

type SeedAuthPasswordResult =
  | { authUserId: string; previousAuthUserId?: undefined }
  | { authUserId: string; previousAuthUserId: string };

/**
 * Set Auth password to the employee number.
 * `updateUserById` enforces strength rules; `createUser` does not — so on weak-
 * password rejection we create a replacement Auth user. Caller must relink the
 * profile, delete `previousAuthUserId`, then restore the canonical email.
 */
async function setSeedAuthPassword(
  admin: SupabaseClient,
  opts: {
    authUserId: string;
    employeeNumber: string;
    fullName: string;
  },
): Promise<SeedAuthPasswordResult> {
  const { error } = await admin.auth.admin.updateUserById(opts.authUserId, {
    password: opts.employeeNumber,
  });

  if (!error) {
    return { authUserId: opts.authUserId };
  }

  if (!isWeakPasswordError(error.message)) {
    throw new Error(
      `Reset password ${opts.employeeNumber}: ${error.message}`,
    );
  }

  const tempEmail = `${opts.employeeNumber}+seed-reset-${Date.now()}@${AUTH_EMAIL_DOMAIN}`;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: tempEmail,
      password: opts.employeeNumber,
      email_confirm: true,
      user_metadata: {
        employee_number: opts.employeeNumber,
        full_name: opts.fullName,
      },
    });

  if (createError || !created.user) {
    throw new Error(
      `Recreate auth ${opts.employeeNumber}: ${createError?.message ?? "create failed"}`,
    );
  }

  return {
    authUserId: created.user.id,
    previousAuthUserId: opts.authUserId,
  };
}

async function finalizeAuthRecreate(
  admin: SupabaseClient,
  opts: {
    newAuthUserId: string;
    previousAuthUserId: string;
    email: string;
    employeeNumber: string;
  },
): Promise<void> {
  const { error: deleteOldError } = await admin.auth.admin.deleteUser(
    opts.previousAuthUserId,
  );
  if (deleteOldError) {
    // Profile already points at the new auth user; old auth user is orphaned.
  }

  const { error: emailError } = await admin.auth.admin.updateUserById(
    opts.newAuthUserId,
    { email: opts.email, email_confirm: true },
  );
  if (emailError) {
    throw new Error(
      `Relink email ${opts.employeeNumber}: ${emailError.message || JSON.stringify(emailError)}`,
    );
  }
}

/**
 * Ensure Auth + profile for a seed user.
 * - Always sets Auth password = employee number (new and existing).
 * - Always sets must_change_password = false for easy QA login.
 * - Existing profiles: also update deterministic seed fields (name, phone, role, is_active).
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
    const authResult = await setSeedAuthPassword(admin, {
      authUserId: existingProfile.auth_user_id,
      employeeNumber: def.employeeNumber,
      fullName: def.fullName,
    });

    const { error: updateError } = await admin
      .from("users")
      .update({
        auth_user_id: authResult.authUserId,
        full_name: def.fullName,
        phone: def.phone,
        role: def.role,
        is_active: true,
        email,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingProfile.id);

    if (updateError) {
      if (authResult.previousAuthUserId) {
        await admin.auth.admin.deleteUser(authResult.authUserId);
      }
      throw new Error(
        `Update user ${def.employeeNumber}: ${updateError.message}`,
      );
    }

    if (authResult.previousAuthUserId) {
      await finalizeAuthRecreate(admin, {
        newAuthUserId: authResult.authUserId,
        previousAuthUserId: authResult.previousAuthUserId,
        email,
        employeeNumber: def.employeeNumber,
      });
    }

    return { id: existingProfile.id, created: false };
  }

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    throw new Error(`List auth users: ${listError.message}`);
  }

  let authUserId = listed.users.find((u) => u.email === email)?.id;
  let createdAuth = false;
  let previousAuthUserId: string | undefined;

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
  } else {
    const authResult = await setSeedAuthPassword(admin, {
      authUserId,
      employeeNumber: def.employeeNumber,
      fullName: def.fullName,
    });
    authUserId = authResult.authUserId;
    previousAuthUserId = authResult.previousAuthUserId;
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
    if (createdAuth || previousAuthUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    throw insertError ?? new Error(`Profile create failed for ${email}`);
  }

  if (previousAuthUserId) {
    await finalizeAuthRecreate(admin, {
      newAuthUserId: authUserId,
      previousAuthUserId,
      email,
      employeeNumber: def.employeeNumber,
    });
  }

  return { id: profile.id, created: true };
}
