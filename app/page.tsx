import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";

/** Reads the session cookie, so this route renders per request. */
export const instant = false;

export default async function Home() {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  if (user.mustChangePassword) redirect("/account/password?required=1");

  redirect("/dashboard");
}