import type { Metadata } from "next";
import { RoleOnboarding } from "@/components/RoleOnboarding";

export const metadata: Metadata = { title: "Create a contractor profile | Paydae" };

export default function ContractorPage() {
  return <RoleOnboarding role="contractor" />;
}
