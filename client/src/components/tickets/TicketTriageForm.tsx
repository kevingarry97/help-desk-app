import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TicketCategory, TicketStatus } from "core/constants/ticket";
import {
  ticketTriageSchema,
  type TicketDetail,
  type TicketTriageValues,
} from "core/schemas/tickets";

import ErrorAlert from "@/components/ErrorAlert";
import { useUpdateTicket } from "@/hooks/use-tickets";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL } from "@/lib/ticket-labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_ITEMS = Object.values(TicketStatus);
const CATEGORY_ITEMS = Object.values(TicketCategory);

export default function TicketTriageForm({
  ticket,
  onDone,
}: {
  ticket: TicketDetail;
  onDone: () => void;
}) {
  const update = useUpdateTicket(ticket.id);

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<TicketTriageValues>({
    resolver: zodResolver(ticketTriageSchema),
    defaultValues: { status: ticket.status, category: ticket.category },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => update.mutate(values, { onSuccess: onDone }))}
      className="mt-2 space-y-4"
      noValidate
    >
      <ErrorAlert error={update.error} fallback="Couldn't save the changes. Please try again." />

      <Field
        control={control}
        name="status"
        label="Status"
        items={TICKET_STATUS_LABEL}
        options={STATUS_ITEMS}
        disabled={update.isPending}
      />
      <Field
        control={control}
        name="category"
        label="Category"
        items={TICKET_CATEGORY_LABEL}
        options={CATEGORY_ITEMS}
        disabled={update.isPending}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={update.isPending} onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={update.isPending || !isDirty}
          className="bg-brand-600 hover:bg-brand-700"
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

type FieldProps<K extends "status" | "category"> = {
  control: ReturnType<typeof useForm<TicketTriageValues>>["control"];
  name: K;
  label: string;
  items: Record<TicketTriageValues[K], string>;
  options: readonly TicketTriageValues[K][];
  disabled: boolean;
};

function Field<K extends "status" | "category">({
  control,
  name,
  label,
  items,
  options,
  disabled,
}: FieldProps<K>) {
  const id = `ticket-${name}`;

  return (
    <div>
      <Label htmlFor={id} className="mb-2">
        {label}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            items={items}
            value={field.value}
            disabled={disabled}
            onValueChange={(next) => field.onChange(next)}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {items[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}
