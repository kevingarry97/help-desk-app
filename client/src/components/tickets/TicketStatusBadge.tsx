import { cn } from "cn";
import type { TicketStatus } from "core/constants/ticket";

import { STATUS_STYLE } from "@/components/tickets/ticket-style";
import { TICKET_STATUS_LABEL } from "@/lib/ticket-labels";
import { Badge } from "@/components/ui/badge";

type Props = {
  status: TicketStatus;
  className?: string;
};

export default function TicketStatusBadge({ status, className }: Props) {
  const style = STATUS_STYLE[status];

  return (
    <Badge data-status={status} className={cn("gap-1.5 pl-1.5", style.fill, className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.mark)} />
      {TICKET_STATUS_LABEL[status]}
    </Badge>
  );
}
