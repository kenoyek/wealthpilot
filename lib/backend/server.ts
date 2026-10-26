import { cache } from "react";
import { createClient } from "@neondatabase/neon-js";
import {
  db as localDb,
  configured as localConfigured,
} from "@/lib/supabase/server";
import { neonAuth, neonConfigured } from "./neon-auth";
import { sessionAllowed } from "../release-policy";
export function usesNeon() {
  return (
    Boolean(process.env.NEON_AUTH_BASE_URL || process.env.NEON_DATA_API_URL) ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}
export function configured() {
  return usesNeon() ? neonConfigured() : localConfigured();
}
type ErrorInfo = { message: string } | null;
type Result<T> = { data: T; error: ErrorInfo };
export interface AppUser {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  email_verified?: boolean;
}
interface AppAuth {
  getUser(): Promise<Result<{ user: AppUser | null }>>;
  signInWithPassword(p: {
    email: string;
    password: string;
  }): Promise<Result<{ session: unknown | null }>>;
  signUp(p: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string };
  }): Promise<Result<{ session: unknown | null }>>;
  signOut(): Promise<{ error: ErrorInfo }>;
  resetPasswordForEmail(
    email: string,
    p: { redirectTo: string },
  ): Promise<{ error: ErrorInfo }>;
  updateUser(p: {
    password: string;
    currentPassword?: string;
  }): Promise<{ error: ErrorInfo }>;
  exchangeCodeForSession(code: string): Promise<{ error: ErrorInfo }>;
  verifyOtp(p: {
    token_hash: string;
    type: "signup" | "recovery" | "email";
  }): Promise<{ error: ErrorInfo }>;
}
function problem(e: unknown): ErrorInfo {
  return e
    ? {
        message:
          typeof e === "object" && "message" in e
            ? String(e.message)
            : "Authentication request failed.",
      }
    : null;
}
export const db = cache(async function db() {
  if (!configured()) throw new Error("Backend is not configured.");
  if (!usesNeon()) {
    const local = await localDb();
    const data = createClient({
      dataApi: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL! + "/rest/v1",
        getToken: async () => {
          const { data } = await local.auth.getSession();
          return data.session?.access_token || null;
        },
        options: {
          global: {
            fetch,
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            },
          },
        },
      },
    });
    const auth: AppAuth = {
      getUser: async () => {
        const r = await local.auth.getUser();
        if (
          r.data.user &&
          sessionAllowed(
            r.data.user.email,
            Boolean(r.data.user.email_confirmed_at),
          )
        ) {
          const init = await data.rpc("initialize_workspace");
          if (init.error)
            return {
              data: { user: null },
              error: { message: "Unable to prepare your workspace." },
            };
        }
        return r;
      },
      signInWithPassword: (p) => local.auth.signInWithPassword(p),
      signUp: (p) => local.auth.signUp(p),
      signOut: () => local.auth.signOut(),
      resetPasswordForEmail: (email, p) =>
        local.auth.resetPasswordForEmail(email, p),
      updateUser: (p) => local.auth.updateUser({ password: p.password }),
      exchangeCodeForSession: (p) => local.auth.exchangeCodeForSession(p),
      verifyOtp: (p) => local.auth.verifyOtp(p),
    };
    return { auth, from: data.from.bind(data), rpc: data.rpc.bind(data) };
  }
  const authServer = neonAuth();
  let tokenRequest: Promise<string | null> | undefined;
  const data = createClient({
    dataApi: {
      url: process.env.NEON_DATA_API_URL!,
      getToken: () => {
        tokenRequest ||= (async () => {
          const r = await authServer.token();
          return r.error ? null : r.data?.token || null;
        })();
        return tokenRequest;
      },
    },
  });
  const auth: AppAuth = {
    async getUser() {
      const r = await authServer.getSession();
      const native = r.data?.user;
      if (r.error || !native)
        return { data: { user: null }, error: problem(r.error) };
      if (!sessionAllowed(native.email, native.emailVerified))
        return {
          data: { user: null },
          error: { message: "Owner invitation required." },
        };
      const identity = await data.rpc("ensure_application_user");
      if (identity.error)
        return {
          data: { user: null },
          error: {
            message: "Unable to prepare your verified workspace. Please retry.",
          },
        };
      return {
        data: {
          user: {
            id: String(identity.data),
            email: native.email,
            email_verified: native.emailVerified,
          },
        },
        error: null,
      };
    },
    async signInWithPassword(p) {
      const r = await authServer.signIn.email(p);
      return { data: { session: r.data || null }, error: problem(r.error) };
    },
    async signUp(p) {
      const r = await authServer.signUp.email({
        email: p.email,
        password: p.password,
        name: p.email.split("@")[0],
        callbackURL: p.options?.emailRedirectTo,
      });
      return {
        data: { session: r.data?.token || null },
        error: problem(r.error),
      };
    },
    async signOut() {
      const r = await authServer.signOut();
      return { error: problem(r.error) };
    },
    async resetPasswordForEmail(email, p) {
      const r = await authServer.requestPasswordReset({
        email,
        redirectTo: p.redirectTo.replace(
          "/auth/confirm",
          "/auth/reset-password",
        ),
      });
      return { error: problem(r.error) };
    },
    async updateUser(p) {
      if (!p.currentPassword)
        return { error: { message: "Enter your current password." } };
      const r = await authServer.changePassword({
        currentPassword: p.currentPassword,
        newPassword: p.password,
        revokeOtherSessions: true,
      });
      return { error: problem(r.error) };
    },
    async exchangeCodeForSession() {
      return { error: { message: "Use the Neon Auth confirmation link." } };
    },
    async verifyOtp() {
      return { error: { message: "Use the Neon Auth confirmation link." } };
    },
  };
  return { auth, from: data.from.bind(data), rpc: data.rpc.bind(data) };
});
