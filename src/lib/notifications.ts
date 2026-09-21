import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { readTemplates } from "@/lib/visit-alert-templates";

/** The signed-in user's own message settings (Settings → Notifications). */
export async function getMyNotificationSettings() {
  const ctx = await requireTenantContext();
  const user = await withTenantContext(ctx, (tx) =>
    tx.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { phone: true, notifyEmail: true, notifySms: true, smsConsentAt: true, email: true },
    }),
  );
  return user;
}

/** The organization's wording for the weekly message (the defaults where it hasn't set its own). */
export async function getAlertTemplates() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return { templates: readTemplates(null), custom: false };
  const org = await withTenantContext(ctx, (tx) =>
    tx.organization.findUnique({ where: { id: ctx.organizationId! }, select: { visitAlertTemplates: true } }),
  );
  return { templates: readTemplates(org?.visitAlertTemplates), custom: org?.visitAlertTemplates != null };
}
