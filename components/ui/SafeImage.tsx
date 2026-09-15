"use client";

import * as React from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fallbackIcon?: React.ReactNode;
  fallbackLabel?: string;
  grayscale?: boolean;
}

/**
 * Remote image with a graceful gradient fallback so card geometry never depends
 * on the network. Uses next/image with `fill`; parent must be positioned.
 */
export function SafeImage({ src, alt, className, sizes = "(max-width: 768px) 100vw, 50vw", priority, fallbackIcon, fallbackLabel, grayscale }: SafeImageProps) {
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const show = src && !failed;
  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-gradient-to-br from-surface-3 via-surface-2 to-bg", className)}>
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
      {!show && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-3">
          <span className="[&>svg]:size-7 opacity-70">{fallbackIcon ?? <Camera />}</span>
          {fallbackLabel && <span className="text-xs font-medium">{fallbackLabel}</span>}
        </div>
      )}
      {show && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", grayscale && "grayscale contrast-110")}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
