import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <Topbar />
      <main className="pl-60 pt-14">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
