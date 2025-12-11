import { redirect } from "next/navigation";

export default function DashboardPage() {
  // Redirect to projects page as default dashboard
  redirect("/dashboard/projects");
}


