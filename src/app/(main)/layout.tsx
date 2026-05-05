import { BottomNav } from "@/components/shared/bottom-nav";

export const dynamic = "force-dynamic";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 pt-16">
      {children}
      <BottomNav />
    </div>
  );
}
