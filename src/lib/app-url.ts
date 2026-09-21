import { headers } from "next/headers";

/**
 * The address people reach this site at, for links in emails. NEXTAUTH_URL wins
 * when it is set (the deployed site's own address): building a link from the
 * request's Host header alone would let a forged Host header point a password-reset
 * email at someone else's site. The request's own host is only the fallback.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/** The caller's IP address as far as the platform tells us (for throttling, not for trust). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}
