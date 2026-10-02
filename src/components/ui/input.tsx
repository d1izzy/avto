import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("flex h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-base text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50", className)} {...props} />
));
Input.displayName = "Input";
