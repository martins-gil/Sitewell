export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isWithinDays(date: Date | null, days: number): boolean {
  if (!date) return false;
  return date.getTime() - Date.now() < days * 24 * 60 * 60 * 1000;
}

/** Whole days from now until the date (negative once it's past). */
export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function isPast(date: Date | null): boolean {
  if (!date) return false;
  return date.getTime() < Date.now();
}

export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
