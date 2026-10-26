import { z } from "zod";
export interface ReleaseSettings {
  vercelEnv?: string;
  privateRelease?: string;
  ownerEmail?: string;
  ownerSetup?: string;
}
export function releaseSettings(): ReleaseSettings {
  return {
    vercelEnv: process.env.VERCEL_ENV,
    privateRelease: process.env.WEALTHPILOT_PRIVATE_RELEASE,
    ownerEmail: process.env.WEALTHPILOT_OWNER_EMAIL,
    ownerSetup: process.env.WEALTHPILOT_OWNER_SETUP,
  };
}
export function privateRelease(settings: ReleaseSettings = releaseSettings()) {
  return (
    settings.privateRelease === "true" ||
    settings.vercelEnv === "production" ||
    settings.vercelEnv === "preview"
  );
}
export function ownerEmailAllowed(
  email: string | undefined,
  settings: ReleaseSettings = releaseSettings(),
) {
  if (!privateRelease(settings)) return true;
  const owner = settings.ownerEmail?.trim().toLowerCase();
  return Boolean(
    owner &&
    z.email().safeParse(owner).success &&
    email?.trim().toLowerCase() === owner,
  );
}
export function sessionAllowed(
  email: string | undefined,
  confirmed: boolean,
  settings: ReleaseSettings = releaseSettings(),
) {
  return (
    ownerEmailAllowed(email, settings) &&
    (!privateRelease(settings) || confirmed)
  );
}
export const privateSignInMessage =
  "Unable to sign in. Check your credentials or owner invitation.";

export function ownerSetupAllowed(
  email: string | undefined,
  settings: ReleaseSettings = releaseSettings(),
) {
  return (
    privateRelease(settings) &&
    settings.ownerSetup === "true" &&
    ownerEmailAllowed(email, settings)
  );
}
