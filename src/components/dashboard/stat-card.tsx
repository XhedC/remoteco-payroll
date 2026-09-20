import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          {hint && (
            <p
              className={cn(
                "mt-1 text-xs",
                tone === "positive" && "text-emerald-600 dark:text-emerald-400",
                tone === "warning" && "text-amber-600 dark:text-amber-400",
                tone === "default" && "text-muted-foreground",
              )}
            >
              {hint}
            </p>
          )}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4.5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
