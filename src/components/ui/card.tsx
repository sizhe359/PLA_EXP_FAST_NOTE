import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-[0_8px_30px_rgba(25,65,47,0.05)] sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
