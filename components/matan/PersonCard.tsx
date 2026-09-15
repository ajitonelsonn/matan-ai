"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import type { FamilyMember, FamilyPresence } from "@/lib/types";
import type { Tone } from "@/lib/utils/tones";

export const presenceTone: Record<FamilyPresence, Tone> = { home: "success", away: "primary", unknown: "neutral", attention: "danger" };
export const presenceLabel: Record<FamilyPresence, string> = { home: "At home", away: "Away", unknown: "Not detected", attention: "Needs attention" };

export function PersonCard({ member, onClick, selected, className }: { member: FamilyMember; onClick?: () => void; selected?: boolean; className?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        "card flex min-w-[112px] flex-col items-center gap-2 px-3 py-4 text-center transition-[border-color,box-shadow,transform] duration-150",
        onClick && "hover:border-border-strong hover:-translate-y-0.5",
        selected && "border-primary/60 glow-strong",
        className,
      )}
    >
      <Avatar name={member.name} src={member.avatarUrl} size="lg" status={presenceTone[member.presence]} />
      <div className="leading-tight">
        <p className="text-[14.5px] font-semibold text-text">{member.name}</p>
        <p className="text-[12.5px] text-text-3">{member.role}</p>
      </div>
    </Tag>
  );
}
