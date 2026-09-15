"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";
import { toneStyles, type Tone } from "@/lib/utils/tones";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: Tone | null;
  ring?: boolean;
  className?: string;
}

const sizes = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base", xl: "size-20 text-xl" };
const dots = { xs: "size-2 -right-0 -bottom-0", sm: "size-2.5 right-0 bottom-0", md: "size-3 right-0 bottom-0", lg: "size-3.5 right-0.5 bottom-0.5", xl: "size-4 right-1 bottom-1" };

export function Avatar({ name, src, size = "md", status, ring, className }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const showImg = src && !failed;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/40 to-purple/40 font-semibold text-text",
          sizes[size],
          ring && "ring-2 ring-primary/60 ring-offset-2 ring-offset-bg",
        )}
        aria-label={name}
        role="img"
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="size-full object-cover" onError={() => setFailed(true)} loading="lazy" />
        ) : (
          initials(name)
        )}
      </span>
      {status && <span className={cn("absolute rounded-full ring-2 ring-bg", dots[size], toneStyles[status].dot)} aria-hidden />}
    </span>
  );
}

export function AvatarStack({ people, size = "sm", max = 4 }: { people: { name: string; src?: string }[]; size?: AvatarProps["size"]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.name + i} name={p.name} src={p.src} size={size} className={cn(i > 0 && "-ml-2", "ring-2 ring-surface rounded-full")} />
      ))}
      {rest > 0 && (
        <span className={cn("-ml-2 inline-flex items-center justify-center rounded-full bg-surface-3 text-text-2 font-semibold ring-2 ring-surface", sizes[size])}>+{rest}</span>
      )}
    </span>
  );
}
