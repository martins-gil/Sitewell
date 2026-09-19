import type { ReactNode } from "react";
import { auth } from "@/auth";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const canManageTeam = session?.user?.role === "ORG_ADMIN" || Boolean(session?.user?.isPlatformAdmin);

  return (
    <div>
      <SettingsTabs canManageTeam={canManageTeam} />
      {children}
    </div>
  );
}
