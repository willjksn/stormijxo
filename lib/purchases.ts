/**
 * Treat purchases: Firestore shape and schedule fields.
 * Webhook writes purchases; admin updates with schedule; members read own.
 */

export type PurchaseScheduleStatus = "pending" | "scheduled";

export type PurchaseDoc = {
  id: string;
  email: string | null;
  productName: string | null;
  treatId: string | null;
  amountCents: number | null;
  createdAt: Date | null;
  scheduleStatus: PurchaseScheduleStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduledAt: Date | null;
};

export const PURCHASES_COLLECTION = "purchases";

export function purchaseFromDoc(id: string, data: Record<string, unknown>): PurchaseDoc {
  const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const purchasedAt = (data.purchasedAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const scheduledAt = (data.scheduledAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const scheduleStatus = (data.scheduleStatus as PurchaseScheduleStatus) || "pending";
  return {
    id,
    email: data.email != null ? String(data.email) : null,
    productName: data.productName != null ? String(data.productName) : null,
    treatId: data.treatId != null ? String(data.treatId) : null,
    amountCents: typeof data.amountCents === "number" ? data.amountCents : null,
    createdAt: createdAt ?? purchasedAt,
    scheduleStatus: scheduleStatus === "scheduled" ? "scheduled" : "pending",
    scheduledDate: data.scheduledDate != null ? String(data.scheduledDate) : null,
    scheduledTime: data.scheduledTime != null ? String(data.scheduledTime) : null,
    scheduledAt,
  };
}
