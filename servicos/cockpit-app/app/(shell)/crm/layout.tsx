import CrmTabs from "@/components/crm/CrmTabs";
import CrmSwipe from "@/components/crm/CrmSwipe";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSwipe>
      <h1 className="text-2xl font-semibold text-tinta">CRM</h1>
      <CrmTabs />
      {children}
    </CrmSwipe>
  );
}
