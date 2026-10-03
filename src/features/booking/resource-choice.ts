import type { AvailabilitySlot, BookingResource } from "@/types/database";

export const ANY_RESOURCE = "any";

export function slotsForResource(slots: AvailabilitySlot[], resources: BookingResource[], choice: string) {
  const eligibleIds = new Set(resources.map((resource) => resource.id));
  const times = new Set<string>();
  return slots.filter((slot) => {
    if (!eligibleIds.has(slot.resource_id) || (choice !== ANY_RESOURCE && slot.resource_id !== choice)) return false;
    if (times.has(slot.starts_at)) return false;
    times.add(slot.starts_at);
    return true;
  });
}
