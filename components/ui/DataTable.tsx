"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Hide this column on the stacked mobile card view */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  dense?: boolean;
}

/** Table on md+ screens; stacked cards below md. Never overflows the page. */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, emptyTitle = "Nothing here yet", emptyDescription, className, dense }: DataTableProps<T>) {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} compact />;
  return (
    <div className={cn("w-full", className)}>
      <div className="hidden md:block overflow-x-auto rounded-[14px] border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-bg/50 text-left text-[11px] uppercase tracking-wide text-text-3">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-3 font-semibold", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick(row)) : undefined}
                className={cn("border-t border-border transition-colors", onRowClick && "cursor-pointer hover:bg-primary/6 focus-visible:bg-primary/8")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4", dense ? "py-2.5" : "py-3.5", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden space-y-2">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick(row)) : undefined}
              className={cn("card-inset p-4 space-y-2", onRowClick && "cursor-pointer hover:border-border-strong")}
            >
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-xs font-medium text-text-3 pt-0.5">{c.header}</span>
                    <span className="text-right">{c.render(row)}</span>
                  </div>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
