import type { Metadata } from "next";
import { RoleOnboarding } from "@/components/RoleOnboarding";

export const metadata: Metadata = { title: "Create an auditor profile | Paydae" };

export default function AuditorPage() {
  return <RoleOnboarding role="auditor" />;
}
