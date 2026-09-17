import { cn } from "cn";
import type { TicketCategory } from "core/constants/ticket";

import { CATEGORY_STYLE } from "@/components/tickets/ticket-style";
import { TICKET_CATEGORY_LABEL } from "@/lib/ticket-labels";

type Props = {
  category: TicketCategory;
  className?: string;
};

export default function TicketCategoryTag({ category, className }: Props) {
  return (
    <span
      data-category={category}
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap",
        CATEGORY_STYLE[category].fill,
        className,
      )}
    >
      {TICKET_CATEGORY_LABEL[category]}
    </span>
  );
}
