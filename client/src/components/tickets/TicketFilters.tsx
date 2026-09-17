import { useId } from "react";
import { cn } from "cn";
import type { TicketCategory, TicketStatus } from "core/constants/ticket";

import { CATEGORY_STYLE, STATUS_STYLE } from "@/components/tickets/ticket-style";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL } from "@/lib/ticket-labels";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ALL = "all";

const chip = "h-8 rounded-full border-border bg-card px-3.5 text-foreground hover:bg-muted";

const chosen = "aria-pressed:border-brand-500 aria-pressed:bg-brand-50 aria-pressed:text-brand-700";

type OptionStyle = { mark: string; pressed: string };

type FilterGroupProps<T extends string> = {
  label: string;
  value: T | undefined;
  labels: Record<T, string>;
  onChange: (value: T | undefined) => void;
  styleFor?: (option: T) => OptionStyle;
};

function FilterGroup<T extends string>({
  label,
  value,
  labels,
  onChange,
  styleFor,
}: FilterGroupProps<T>) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span
        id={labelId}
        className="text-[0.6875rem] font-semibold tracking-wider text-surface-muted-foreground uppercase sm:w-16"
      >
        {label}
      </span>

      <ToggleGroup
        aria-labelledby={labelId}
        variant="outline"
        size="sm"
        spacing={1.5}
        className="flex-wrap"
        value={[value ?? ALL]}
        onValueChange={(values) => {
          const [next] = values as string[];
          onChange(next && next !== ALL ? (next as T) : undefined);
        }}
      >
        <ToggleGroupItem value={ALL} className={cn(chip, chosen)}>
          All
        </ToggleGroupItem>

        {(Object.keys(labels) as T[]).map((option) => {
          const style = styleFor?.(option);

          return (
            <ToggleGroupItem
              key={option}
              value={option}
              className={cn(chip, style ? style.pressed : chosen)}
            >
              {style && <span aria-hidden="true" className={style.mark} />}
              {labels[option]}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}

type Props = {
  status: TicketStatus | undefined;
  category: TicketCategory | undefined;
  onStatusChange: (status: TicketStatus | undefined) => void;
  onCategoryChange: (category: TicketCategory | undefined) => void;
};

export default function TicketFilters({
  status,
  category,
  onStatusChange,
  onCategoryChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-x-10">
      <FilterGroup
        label="Status"
        value={status}
        labels={TICKET_STATUS_LABEL}
        onChange={onStatusChange}
        styleFor={(option) => ({
          mark: cn("size-2 rounded-full", STATUS_STYLE[option].mark),
          pressed: STATUS_STYLE[option].pressed,
        })}
      />
      <FilterGroup
        label="Category"
        value={category}
        labels={TICKET_CATEGORY_LABEL}
        onChange={onCategoryChange}
        styleFor={(option) => ({
          mark: cn("size-2 rounded-[2px]", CATEGORY_STYLE[option].mark),
          pressed: CATEGORY_STYLE[option].pressed,
        })}
      />
    </div>
  );
}
