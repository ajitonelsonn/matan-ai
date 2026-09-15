import { SafeImage } from "@/components/ui/SafeImage";
import { images } from "@/lib/mock/images";
import { cn } from "@/lib/utils/cn";

/** Flag of Timor-Leste as inline SVG (not a brand asset; drawn from the official geometry). */
export function TimorFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={cn("h-4 w-8 rounded-[3px] shadow", className)} role="img" aria-label="Flag of Timor-Leste">
      <rect width="60" height="30" fill="#DC241F" />
      <polygon points="0,0 34.5,15 0,30" fill="#FFC726" />
      <polygon points="0,0 23,15 0,30" fill="#000000" />
      <polygon
        fill="#ffffff"
        transform="translate(9.4 15) rotate(-18) scale(4.1)"
        points="0,-1 0.2245,-0.309 0.9511,-0.309 0.3633,0.118 0.5878,0.809 0,0.382 -0.5878,0.809 -0.3633,0.118 -0.9511,-0.309 -0.2245,-0.309"
      />
    </svg>
  );
}

export function TimorIdentityCard({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border h-[92px]", className)}>
      <SafeImage src={images.timorLandscape} alt="Timor-Leste landscape" sizes="240px" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/70 to-bg/20" aria-hidden />
      <div className="relative flex h-full items-end justify-between p-3.5">
        <p className="text-[12.5px] leading-[1.35] text-text-2">
          Safer Homes
          <br />
          Stronger Communities
          <br />
          <span className="font-semibold text-text">Timor-Leste</span>
        </p>
        <TimorFlag />
      </div>
    </div>
  );
}
