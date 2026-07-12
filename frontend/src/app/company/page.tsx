import { CompanyView } from "@/components/CompanyView";
import { PersonaShell } from "@/components/PersonaShell";

export const metadata = { title: "Paydae — Paydae Inc." };

export default function CompanyPage() {
  return (
    <PersonaShell persona="company">
      <CompanyView />
    </PersonaShell>
  );
}
