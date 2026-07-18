import type { Metadata } from "next";
import { RoleOnboarding } from "@/components/RoleOnboarding";

export const metadata: Metadata = { title: "Create a company | Paydae" };

export default function CompanyPage() {
  return <RoleOnboarding role="company" />;
}
