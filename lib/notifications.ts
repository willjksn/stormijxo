/**
 * In-app notifications: types and collection name.
 * Admin sees notifications where forAdmin == true; members see where forMemberEmail == their email.
 */

export const NOTIFICATIONS_COLLECTION = "notifications";

export type NotificationDoc = {
  id: string;
  forMemberEmail: string | null;
  forAdmin: boolean;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: Date | null;
};

export function notificationFromDoc(id: string, data: Record<string, unknown>): NotificationDoc {
  const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null;
  return {
    id,
    forMemberEmail: data.forMemberEmail != null ? String(data.forMemberEmail) : null,
    forAdmin: data.forAdmin === true,
    type: (data.type as string) ?? "",
    title: (data.title as string) ?? "",
    body: (data.body as string) ?? "",
    link: data.link != null ? String(data.link) : null,
    read: data.read === true,
    createdAt,
  };
}
