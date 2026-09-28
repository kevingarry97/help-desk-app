import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { replyFormSchema } from "core/schemas/tickets";
import type { ReplyFormValues, TicketDetail } from "core/schemas/tickets";
import { TicketStatus } from "core/constants/ticket";

import ErrorAlert from "@/components/ErrorAlert";
import ErrorMessage from "@/components/ErrorMessage";
import { useAddReply } from "@/hooks/use-tickets";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PUBLIC = "public";
const INTERNAL = "internal";

const EMPTY: ReplyFormValues = { body: "", isInternal: false };

/**
 * Answers a ticket. A public reply is what a mail provider would send once one is wired up;
 * an internal note stays here. Either can resolve the ticket in the same write — the one
 * status change an agent can make without the admin-only triage form.
 */
export default function TicketReplyForm({ ticket }: { ticket: TicketDetail }) {
  const reply = useAddReply(ticket.id);
  const bodyId = useId();
  const kindLabelId = useId();

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: EMPTY,
  });

  const isInternal = watch("isInternal");

  const submit = (resolve: boolean) =>
    handleSubmit((values) =>
      reply.mutate({ ...values, resolve }, { onSuccess: () => reset(EMPTY) }),
    );

  return (
    <form onSubmit={submit(false)} className="mt-4 space-y-3" noValidate>
      <ErrorAlert error={reply.error} fallback="Couldn't post the reply. Please try again." />

      <Controller
        control={control}
        name="isInternal"
        render={({ field }) => (
          <>
            <span id={kindLabelId} className="sr-only">
              Reply type
            </span>
            <ToggleGroup
              aria-labelledby={kindLabelId}
              variant="outline"
              size="sm"
              spacing={1.5}
              value={[field.value ? INTERNAL : PUBLIC]}
              // Base UI emits [] when the pressed item is clicked again; keep the current choice.
              onValueChange={(values) => {
                const [next] = values as string[];
                if (next) field.onChange(next === INTERNAL);
              }}
            >
              <ToggleGroupItem value={PUBLIC}>Reply to requester</ToggleGroupItem>
              <ToggleGroupItem value={INTERNAL}>Internal note</ToggleGroupItem>
            </ToggleGroup>
          </>
        )}
      />

      <div>
        <Label htmlFor={bodyId} className="sr-only">
          {isInternal ? "Internal note" : "Reply to requester"}
        </Label>
        <Textarea
          id={bodyId}
          rows={4}
          disabled={reply.isPending}
          aria-invalid={!!errors.body}
          placeholder={
            isInternal ? "Leave a note for the team…" : `Write back to ${ticket.requesterEmail}…`
          }
          {...register("body")}
        />
        <ErrorMessage message={errors.body?.message} />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {ticket.status !== TicketStatus.Resolved && (
          <Button
            type="button"
            variant="outline"
            disabled={reply.isPending}
            onClick={submit(true)}
          >
            {isInternal ? "Note & resolve" : "Reply & resolve"}
          </Button>
        )}
        <Button
          type="submit"
          disabled={reply.isPending}
          className="bg-brand-600 hover:bg-brand-700"
        >
          {reply.isPending ? "Sending…" : isInternal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
