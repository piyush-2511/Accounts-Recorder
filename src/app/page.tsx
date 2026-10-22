import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-session";
import { HOME_BY_ROLE } from "@/lib/constants/roles";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? HOME_BY_ROLE[user.profile.role] : "/login");
}
