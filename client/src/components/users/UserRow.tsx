import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { cn } from "cn";
import type { UserListItem } from "core/schemas/users";
import { Role } from "core/constants/role";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Shared by the header and every row so the columns line up. */
export const USER_GRID =
  "grid grid-cols-[2rem_2rem_minmax(0,1fr)_5.5rem_2rem] items-center gap-3 px-4 sm:grid-cols-[2rem_2.25rem_minmax(0,1fr)_6rem_7rem_2rem] sm:gap-4 sm:px-5";

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");

  return letters.toUpperCase() || "?";
}

const joinedFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatJoined(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : joinedFormat.format(date);
}

type Props = {
  user: UserListItem;
  /** 1-based, so it reads as the position an admin sees rather than an array index. */
  position: number;
  /** Blocks a new drag from starting while the last one is still saving. */
  disabled: boolean;
  onEdit: (user: UserListItem) => void;
};

export default function UserRow({ user, position, disabled, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: user.id, disabled });

  const isAdmin = user.role === Role.Admin;

  return (
    <li
      ref={setNodeRef}
      data-testid="user-row"
      data-user-id={user.id}
      style={{
        // Translate, not Transform: the sortable transform carries a scale factor that
        // would stretch the row's text while it is being dragged past taller neighbours.
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        USER_GRID,
        "relative h-[4.5rem] bg-card transition-colors",
        "border-b border-border last:border-b-0",
        isDragging
          ? // Lifted out of the list: on top of its neighbours, with the card's own border
            // traded for a shadow so it reads as floating above them.
            "z-10 rounded-xl border-b-transparent shadow-[0_12px_28px_-8px_rgb(0_0_0/0.22)] ring-1 ring-foreground/10"
          : "hover:bg-muted/40",
      )}
    >
      {/* `disabled` goes to useSortable, not to the button: the DOM attribute would drop
          focus the instant a keyboard drop starts saving, stranding the user mid-list.
          useSortable puts the state on the element as aria-disabled via `attributes`. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder ${user.name}`}
        className={cn(
          "grid size-8 -ml-1.5 place-items-center rounded-md text-muted-foreground/60 transition-colors",
          "hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging ? "cursor-grabbing text-foreground" : "cursor-grab",
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <span
        className={cn(
          "grid size-7 place-items-center rounded-md text-xs font-semibold tabular-nums",
          isDragging ? "bg-brand-50 text-brand-700" : "bg-muted text-muted-foreground",
        )}
      >
        {position}
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <Avatar size="lg" className="hidden shrink-0 sm:flex">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="bg-brand-50 text-sm font-semibold text-brand-700">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div>
        <Badge
          variant={isAdmin ? "default" : "secondary"}
          className={cn("capitalize", isAdmin && "bg-brand-50 text-brand-700")}
        >
          {user.role}
        </Badge>
      </div>

      <span className="hidden text-sm text-muted-foreground sm:block">
        {formatJoined(user.createdAt)}
      </span>

      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${user.name}`}
        onClick={() => onEdit(user)}
        className="text-muted-foreground"
      >
        <Pencil />
      </Button>
    </li>
  );
}
