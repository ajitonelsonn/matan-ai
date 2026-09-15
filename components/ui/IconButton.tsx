"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "solid" | "outline" | "danger" | "primary" | "glass";
  active?: boolean;
}

const sizes = { sm: "size-8 [&>svg]:size-4", md: "size-10 [&>svg]:size-[18px]", lg: "size-12 [&>svg]:size-5" };
const variants = {
  ghost: "text-text-2 hover:text-text hover:bg-surface-3/70 active:bg-surface-3",
  solid: "bg-surface-3/80 text-text border border-border hover:border-border-strong hover:bg-surface-3 active:bg-surface-2",
  outline: "bg-transparent text-text-2 border border-border hover:text-text hover:border-primary/40 hover:bg-primary/8 active:bg-primary/12",
  danger: "bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20 active:bg-danger/28",
  primary: "bg-gradient-to-b from-primary-2 to-primary text-white shadow-[0_6px_18px_rgba(18,168,255,0.3)] hover:shadow-[0_8px_24px_rgba(18,168,255,0.4)] active:translate-y-px",
  glass: "bg-bg/55 text-text border border-white/10 backdrop-blur-md hover:bg-bg/75 hover:border-white/20 active:bg-bg/85",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", variant = "ghost", active, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
        sizes[size],
        variants[variant],
        active && "bg-primary/16 text-primary border-primary/40",
        className,
      )}
      {...props}
    />
  );
});
