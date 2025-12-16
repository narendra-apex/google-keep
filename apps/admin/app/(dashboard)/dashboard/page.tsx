import { KPICards } from "@/components/dashboard/kpi-cards";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
      </div>
      <KPICards />
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <div className="xl:col-span-2 bg-muted/20 border border-dashed rounded-lg h-[400px] flex items-center justify-center">
          Recent Transactions Widget (To Be Implemented)
        </div>
        <div className="bg-muted/20 border border-dashed rounded-lg h-[400px] flex items-center justify-center">
          Recent Sales Widget (To Be Implemented)
        </div>
      </div>
    </div>
  );
}
