import { cache } from "react";
import { redirect } from "next/navigation";
import { db, configured } from "./backend/server";
import { sessionAllowed, privateSignInMessage } from "./release-policy";
export const session = cache(async function session() {
  if (!configured()) redirect("/setup");
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  if (user.closed) redirect("/account/deletion");
  if (
    !sessionAllowed(
      user.email,
      Boolean(user.email_verified || user.email_confirmed_at),
    )
  )
    redirect("/login?error=" + encodeURIComponent(privateSignInMessage));
  return { client, user };
});
