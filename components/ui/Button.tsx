"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "success" | "subtle";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-primary-2 to-primary text-white shadow-[0_6px_20px_rgba(18,168,255,0.28)] hover:from-[#3dd0ff] hover:to-[#1ab0ff] hover:shadow-[0_8px_26px_rgba(18,168,255,0.38)] active:translate-y-px active:shadow-[0_3px_12px_rgba(18,168,255,0.25)] disabled:from-surface-3 disabled:to-surface-3 disabled:text-text-3 disabled:shadow-none",
  secondary:
    "bg-surface-3/80 text-text border border-border hover:bg-surface-3 hover:border-border-strong active:bg-surface-2 disabled:text-text-3 disabled:hover:bg-surface-3/80",
  outline:
    "bg-transparent text-text border border-border hover:bg-primary/8 hover:border-primary/40 active:bg-primary/12 disabled:text-text-3 disabled:hover:bg-transparent",
  ghost:
    "bg-transparent text-text-2 hover:text-text hover:bg-surface-3/70 active:bg-surface-3 disabled:text-text-3 disabled:hover:bg-transparent",
  subtle:
    "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/16 hover:border-primary/40 active:bg-primary/22 disabled:text-text-3 disabled:bg-surface-3/40 disabled:border-border",
  danger:
    "bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20 hover:border-danger/50 active:bg-danger/28 disabled:text-text-3 disabled:bg-surface-3/40 disabled:border-border",
  success:
    "bg-success/12 text-success border border-success/30 hover:bg-success/20 hover:border-success/50 active:bg-success/28 disabled:text-text-3 disabled:bg-surface-3/40 disabled:border-border",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  sm: "h-9 px-3.5 text-[13px] gap-2 rounded-[10px]",
  md: "h-10.5 px-4 text-sm gap-2 rounded-control",
  lg: "h-12 px-5 text-[15px] gap-2.5 rounded-control",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  href?: string;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, leftIcon, rightIcon, href, fullWidth, children, disabled, type = "button", ...props },
  ref,
) {
  const classes = cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap select-none transition-[background-color,border-color,box-shadow,transform,color] duration-150 ease-out disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </>
  );
  if (href && !disabled) {
    // External links open in a new tab so the user keeps their Matan session (e.g. Ring Playground).
    if (/^https?:\/\//i.test(href)) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener" className={classes} aria-busy={loading || undefined}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} aria-busy={loading || undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
});
