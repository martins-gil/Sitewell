import { humanizeEnum } from "@/lib/format";

const COLORS: Record<string, string> = {
  // Subject funnel
  IDENTIFIED: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  PRE_SCREENED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  SCREENED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  CONSENTED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  ENROLLED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  SCREEN_FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  WITHDRAWN: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  // Visit status
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  MISSED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  RESCHEDULED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  // Document status
  DRAFT: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  EXPIRED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  SUPERSEDED: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

export function Badge({ value }: { value: string }) {
  const color = COLORS[value] ?? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {humanizeEnum(value)}
    </span>
  );
}
