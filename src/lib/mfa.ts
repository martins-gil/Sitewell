import { authenticator } from "otplib";
import QRCode from "qrcode";

const ISSUER = "SiteWell-ct";

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function getMfaOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export function getMfaQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl);
}

export function verifyMfaToken(token: string, secret: string): boolean {
  return authenticator.check(token, secret);
}
