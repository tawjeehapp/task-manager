import dayjs from "dayjs";
import "dayjs/locale/ar";

dayjs.locale("ar");

export { dayjs };

export function formatDate(value: string | Date, format = "YYYY/MM/DD"): string {
  return dayjs(value).format(format);
}

export function formatDateTime(
  value: string | Date,
  format = "YYYY/MM/DD HH:mm",
): string {
  return dayjs(value).format(format);
}
