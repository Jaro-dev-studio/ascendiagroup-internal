import { SidebarNav } from "@/components/layout/sidebar-nav";
import { requireStaff } from "@/lib/auth-helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaff();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background lg:flex-row">
      <SidebarNav
        role={user.role}
        name={user.name ?? ""}
        email={user.email}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
