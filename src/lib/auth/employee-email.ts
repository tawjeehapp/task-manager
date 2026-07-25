export const AUTH_EMAIL_DOMAIN = "task-manager.com";

const EMPLOYEE_NUMBER_PATTERN = /^\d{4}$/;

export function isValidEmployeeNumber(value: string): boolean {
  return EMPLOYEE_NUMBER_PATTERN.test(value);
}

/**
 * Maps a 4-digit employee number to the synthetic Supabase Auth email.
 * Users never enter or see this domain in the UI.
 */
export function toAuthEmail(employeeNumber: string): string {
  if (!isValidEmployeeNumber(employeeNumber)) {
    throw new Error("Invalid employee number");
  }

  return `${employeeNumber}@${AUTH_EMAIL_DOMAIN}`;
}

export function employeeNumberFromAuthEmail(email: string): string | null {
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  if (!email.endsWith(suffix)) {
    return null;
  }

  const number = email.slice(0, -suffix.length);
  return isValidEmployeeNumber(number) ? number : null;
}
