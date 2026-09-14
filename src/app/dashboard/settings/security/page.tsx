import { getCurrentUser } from "@/lib/queries";
import { MfaSettings } from "./mfa-settings";

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
      </div>
      <MfaSettings initialEnabled={user.mfaEnabled} />
    </div>
  );
}
