import { useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { UserListItem } from "core/schemas/users";

import UserRow, { USER_GRID } from "@/components/users/UserRow";
import { moveItem } from "@/lib/reorder";

type Props = {
  users: UserListItem[];
  /** Called with the full list of ids in their new order. */
  onReorder: (ids: string[]) => void;
  /** True while a reorder is in flight — dragging again would race it. */
  isSaving: boolean;
};

export default function UsersTable({ users, onReorder, isSaving }: Props) {
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking or focusing the handle
    // does not register as one.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => users.map((user) => user.id), [users]);

  const positionOf = (id: string) => ids.indexOf(id) + 1;
  const nameOf = (id: string) => users.find((user) => user.id === id)?.name ?? "User";

  // dnd-kit's defaults announce opaque ids ("draggable item nElqtUXE was moved"). Names and
  // positions are the only part of this a screen reader user can act on.
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(String(active.id))}, position ${positionOf(String(active.id))} of ${ids.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(String(active.id))} is now at position ${positionOf(String(over.id))} of ${ids.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(String(active.id))} dropped at position ${positionOf(String(over.id))} of ${ids.length}.`
        : `${nameOf(String(active.id))} returned to its original position.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${nameOf(String(active.id))} returned to its original position.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    onReorder(moveItem(ids, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // Vertical only, and never past the ends of the list: a row dragged sideways or off
      // the card has nowhere meaningful to land.
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements }}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div
          className={`${USER_GRID} h-11 border-b border-border bg-muted/40 text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase`}
        >
          {/* Two empty tracks so the labels line up with the row grid. Not `sr-only`:
              that is absolutely positioned, which drops the element out of the grid and
              shifts every heading one column left. */}
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span>User</span>
          <span>Role</span>
          <span className="hidden sm:block">Joined</span>
        </div>

        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {/* Dragging is closed while a reorder is saving. Each request carries the whole
              order, so a second drag landing mid-flight would put two full-list writes in
              the air with no guarantee the later one answers last. */}
          <ul aria-busy={isSaving} className="isolate">
            {users.map((user, index) => (
              <UserRow
                key={user.id}
                user={user}
                position={index + 1}
                disabled={isSaving}
              />
            ))}
          </ul>
        </SortableContext>
      </div>
    </DndContext>
  );
}
