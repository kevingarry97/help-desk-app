const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * An ISO timestamp as a date and time in the viewer's locale. "—" rather than a thrown
 * RangeError for a value that isn't a date, which would take the whole page down with it.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}
