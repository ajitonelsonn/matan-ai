"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "size"> {
  value: string;
  onChange: (value: string) => void;
  containerClassName?: string;
  size?: "sm" | "md";
}

export function SearchInput({ value, onChange, containerClassName, className, placeholder = "Search…", size = "md", ...props }: SearchInputProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center rounded-control border border-border bg-surface-2/80 text-text-2 transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-primary/50 focus-within:bg-surface-2 focus-within:shadow-[0_0_0_3px_rgba(18,168,255,0.15)] hover:border-border-strong",
        size === "sm" ? "h-9" : "h-10.5",
        containerClassName,
      )}
    >
      <Search className="absolute left-3 size-4 text-text-3 group-focus-within:text-primary transition-colors" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-full w-full bg-transparent pl-9 pr-8 text-sm text-text placeholder:text-text-3 outline-none [&::-webkit-search-cancel-button]:hidden",
          className,
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 inline-flex size-6 items-center justify-center rounded-md text-text-3 hover:text-text hover:bg-surface-3"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
