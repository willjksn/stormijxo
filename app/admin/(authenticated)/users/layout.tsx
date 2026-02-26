/** Force dynamic rendering so Firebase/client code does not run at build time. */
export const dynamic = "force-dynamic";

export default function AdminUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
