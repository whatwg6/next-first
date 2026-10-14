import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth.js";

export async function getSession(requestHeaders) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session || session.user.disabled || !session.user.emailVerified)
    return null;
  return session;
}

export async function requireUser() {
  const session = await getSession(await headers());
  if (!session) redirect("/login");
  return session.user;
}
