import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/session";
import { MarketingHome } from "./(marketing)/home";

export const metadata = {
  title: "Flintel — AI Prospect Intelligence for B2B Sales",
  description:
    "Research any LinkedIn prospect in seconds. Get intelligence reports, opportunity scores, and AI-crafted outreach messages tailored to your business.",
};

export default async function RootPage() {
  const session = await getAuthSession();

  if (session) {
    redirect("/dashboard");
  }

  return <MarketingHome />;
}
