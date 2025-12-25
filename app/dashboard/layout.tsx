import { Header } from "@/components/home/header";
import { UserActivityTracker } from "@/components/user-activity-tracker";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <UserActivityTracker />

      <main className="pt-4 xl:pt-10">{children}</main>
    </div>
  );
}
