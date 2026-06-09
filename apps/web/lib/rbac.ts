import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthedUser } from "./auth.js";

/** Require an authenticated admin; redirect otherwise. Use in admin routes. */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
