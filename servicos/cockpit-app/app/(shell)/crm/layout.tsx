import CrmTabs from "@/components/crm/CrmTabs";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-tinta">CRM</h1>
      <CrmTabs />
      {children}
    </div>
  );
}
