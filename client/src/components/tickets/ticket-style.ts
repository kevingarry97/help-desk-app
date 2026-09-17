import type { TicketCategory, TicketStatus } from "core/constants/ticket";

/**
 * Every class a status or category is drawn with, so the list, the detail page and the
 * filters stay one colour system: statuses are pills with a dot, categories are tags with a
 * square. Full literal strings, because Tailwind only generates classes written out in
 * source; full Records, so a new status or category fails the typecheck until it has colours.
 */
type Style = {
  /** Tint and text for the badge or tag. */
  fill: string;
  /** The dot (status) or square (category) beside a label. */
  mark: string;
  /** A chosen filter chip: the fill, bordered in the accent. */
  pressed: string;
};

export const STATUS_STYLE: Record<TicketStatus, Style> = {
  OPEN: {
    fill: "bg-status-open text-status-open-foreground",
    mark: "bg-status-open-accent",
    pressed:
      "aria-pressed:border-status-open-accent aria-pressed:bg-status-open aria-pressed:text-status-open-foreground",
  },
  RESOLVED: {
    fill: "bg-status-resolved text-status-resolved-foreground",
    mark: "bg-status-resolved-accent",
    pressed:
      "aria-pressed:border-status-resolved-accent aria-pressed:bg-status-resolved aria-pressed:text-status-resolved-foreground",
  },
  CLOSED: {
    fill: "bg-status-closed text-status-closed-foreground",
    mark: "bg-status-closed-accent",
    pressed:
      "aria-pressed:border-status-closed-accent aria-pressed:bg-status-closed aria-pressed:text-status-closed-foreground",
  },
};

/** Heading text for a status section on the page canvas (6.6:1 or better). */
export const STATUS_HEADING: Record<TicketStatus, string> = {
  OPEN: "text-status-open-foreground",
  RESOLVED: "text-status-resolved-foreground",
  CLOSED: "text-status-closed-foreground",
};

export const CATEGORY_STYLE: Record<TicketCategory, Style> = {
  GENERAL_QUESTION: {
    fill: "bg-category-general text-category-general-foreground",
    mark: "bg-category-general-accent",
    pressed:
      "aria-pressed:border-category-general-accent aria-pressed:bg-category-general aria-pressed:text-category-general-foreground",
  },
  TECHNICAL_QUESTION: {
    fill: "bg-category-technical text-category-technical-foreground",
    mark: "bg-category-technical-accent",
    pressed:
      "aria-pressed:border-category-technical-accent aria-pressed:bg-category-technical aria-pressed:text-category-technical-foreground",
  },
  REFUND_REQUEST: {
    fill: "bg-category-refund text-category-refund-foreground",
    mark: "bg-category-refund-accent",
    pressed:
      "aria-pressed:border-category-refund-accent aria-pressed:bg-category-refund aria-pressed:text-category-refund-foreground",
  },
};
