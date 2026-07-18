import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`mb-4 gap-0 py-0 shadow-sm ${className ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-5 py-2">{children}</CardContent>
    </Card>
  );
}
