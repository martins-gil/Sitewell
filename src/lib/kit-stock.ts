// Kit stock: what state a kit is in, and how many kits of a study are left.
//
//   USED       removed from inventory (its visit has happened and it was marked used)
//   ASSIGNED   locked to one patient's visit — no longer available
//   EXPIRED    past its expiry date and not given to anyone — can't be used
//   AVAILABLE  in stock, can be given to a patient's visit
//
// A study is OUT OF STOCK when it has kits on record but none of them is AVAILABLE. That
// raises the banner and the every-3-days email, until someone marks more as requested
// (Study.kitRestockRequestedAt) or adds kits (which clears that mark).

export type KitState = "AVAILABLE" | "ASSIGNED" | "EXPIRED" | "USED";

export type KitStateInput = { usedAt: Date | null; visitId: string | null; expiryDate: Date | null };

export function kitState(kit: KitStateInput, now: Date = new Date()): KitState {
  if (kit.usedAt) return "USED";
  if (kit.visitId) return "ASSIGNED";
  if (kit.expiryDate && kit.expiryDate.getTime() < now.getTime()) return "EXPIRED";
  return "AVAILABLE";
}

export type StudyStock = {
  studyId: string;
  protocolId: string;
  title: string;
  available: number;
  assigned: number;
  expired: number;
  used: number;
  /** Kits on record, used ones included. */
  total: number;
  requestedAt: Date | null;
  /** Kits on record but none available. */
  outOfStock: boolean;
  /** Out of stock and nobody has said more were requested. */
  needsAlert: boolean;
};

export function summarizeStock(
  studies: { id: string; protocolId: string; title: string; kitRestockRequestedAt: Date | null }[],
  kits: (KitStateInput & { studyId: string })[],
  now: Date = new Date(),
): StudyStock[] {
  const byStudy = new Map<string, StudyStock>();
  for (const s of studies) {
    byStudy.set(s.id, {
      studyId: s.id,
      protocolId: s.protocolId,
      title: s.title,
      available: 0,
      assigned: 0,
      expired: 0,
      used: 0,
      total: 0,
      requestedAt: s.kitRestockRequestedAt,
      outOfStock: false,
      needsAlert: false,
    });
  }
  for (const kit of kits) {
    const row = byStudy.get(kit.studyId);
    if (!row) continue;
    row.total++;
    const state = kitState(kit, now);
    if (state === "AVAILABLE") row.available++;
    else if (state === "ASSIGNED") row.assigned++;
    else if (state === "EXPIRED") row.expired++;
    else row.used++;
  }
  for (const row of byStudy.values()) {
    row.outOfStock = row.total > 0 && row.available === 0;
    row.needsAlert = row.outOfStock && row.requestedAt === null;
  }
  return [...byStudy.values()].filter((r) => r.total > 0).sort((a, b) => a.protocolId.localeCompare(b.protocolId));
}

/** How many kits one "add kits" can create at once. */
export const MAX_KITS_PER_ADD = 500;
