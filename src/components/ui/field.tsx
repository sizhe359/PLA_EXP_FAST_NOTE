import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-semibold text-foreground"
    >
      {children}
    </label>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-foreground outline-none transition placeholder:text-[#98a39d] focus:border-primary focus:ring-3 focus:ring-[#087a5520]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-border bg-white px-3 py-3 text-foreground outline-none transition placeholder:text-[#98a39d] focus:border-primary focus:ring-3 focus:ring-[#087a5520]",
        className,
      )}
      {...props}
    />
  );
}
