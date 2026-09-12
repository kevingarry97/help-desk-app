import { Role, type UserRole } from "core/constants/role";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ROLE_OPTIONS = [
  {
    value: Role.Agent,
    label: "Agent",
    hint: "Works the ticket queue.",
  },
  {
    value: Role.Admin,
    label: "Admin",
    hint: "Everything an agent can do, plus managing this list.",
  },
] as const;

type Props = {
  idPrefix: string;
  labelledBy: string;
  value: UserRole;
  onValueChange: (value: UserRole) => void;
  onBlur?: () => void;
  disabled?: boolean;
};

export default function RoleRadioGroup({
  idPrefix,
  labelledBy,
  value,
  onValueChange,
  onBlur,
  disabled,
}: Props) {
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={value}
      onValueChange={(next) => onValueChange(next as UserRole)}
      onBlur={onBlur}
      disabled={disabled}
    >
      {ROLE_OPTIONS.map((option) => {
        const id = `${idPrefix}-${option.value}`;

        return (
          // The whole card is the label, so the hint is part of the hit
          // target rather than dead space beside the dot.
          <Label
            key={option.value}
            htmlFor={id}
            className="items-start gap-3 rounded-lg border border-input p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-muted/40 has-data-disabled:pointer-events-none has-data-disabled:opacity-60"
          >
            {/* Named by the option's own text rather than by the wrapping
                label: a radio built on a button takes its accessible name
                from its contents, and its contents are the indicator dot. */}
            <RadioGroupItem
              id={id}
              value={option.value}
              aria-labelledby={`${id}-label`}
              aria-describedby={`${id}-hint`}
              className="mt-0.5"
            />
            <span className="grid gap-0.5">
              <span id={`${id}-label`} className="font-medium">
                {option.label}
              </span>
              <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">
                {option.hint}
              </span>
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
