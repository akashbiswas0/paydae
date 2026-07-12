import { ContractorView } from "@/components/ContractorView";
import { PersonaShell } from "@/components/PersonaShell";

export const metadata = { title: "Paydae — Bob" };

export default function BobPage() {
  return (
    <PersonaShell persona="bob">
      <ContractorView persona="bob" />
    </PersonaShell>
  );
}
