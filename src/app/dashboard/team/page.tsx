import { redirect } from "next/navigation";

// Team management moved under Settings; keep the old address working.
export default function TeamRedirectPage() {
  redirect("/dashboard/settings/team");
}
