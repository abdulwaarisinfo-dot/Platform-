import { getAuthSession } from "@/lib/session";
import { UserMenu } from "./user-menu";

export async function Topbar() {
  const session = await getAuthSession();

  return (
    <header className="fixed top-0 right-0 left-60 z-20 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      <div />
      <UserMenu email={session?.user.email} name={session?.user.name} />
    </header>
  );
}
