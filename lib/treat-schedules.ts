/**
 * Treat schedules: link a treat purchase (or manual entry) to a date/time.
 * Shown on admin calendar and to the member.
 */

export const TREAT_SCHEDULES_COLLECTION = "treatSchedules";

export type TreatScheduleDoc = {
  id: string;
  purchaseId: string | null;
  treatId: string;
  productName: string;
  memberEmail: string;
  memberName: string | null;
  memberId: string | null;
  scheduledDate: string;
  scheduledTime: string;
  createdAt: number;
  updatedAt: number;
};

export function toTreatScheduleDoc(
  id: string,
  data: Record<string, unknown> | undefined
): TreatScheduleDoc | null {
  if (!data) return null;
  return {
    id,
    purchaseId: (data.purchaseId as string) ?? null,
    treatId: (data.treatId ?? "").toString(),
    productName: (data.productName ?? "").toString(),
    memberEmail: (data.memberEmail ?? "").toString(),
    memberName: data.memberName != null ? String(data.memberName) : null,
    memberId: data.memberId != null ? String(data.memberId) : null,
    scheduledDate: (data.scheduledDate ?? "").toString(),
    scheduledTime: (data.scheduledTime ?? "12:00").toString(),
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}
