import { ContractorView } from "@/components/ContractorView";
import { PersonaShell } from "@/components/PersonaShell";

export const metadata = { title: "Paydae — Alice" };

export default function AlicePage() {
  return (
    <PersonaShell persona="alice">
      <ContractorView persona="alice" />
    </PersonaShell>
  );
}
