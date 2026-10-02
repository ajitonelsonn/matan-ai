"use client";

import * as React from "react";
import { useTheme } from "@/components/experience/theme-provider";

/**
 * Renders a ```mermaid block from the repository markdown as a real diagram.
 * Mermaid is loaded on demand (it is large), and re-rendered when the theme changes.
 */
export function Mermaid({ chart }: { chart: string }) {
  const { resolved } = useTheme();
  const [svg, setSvg] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark = resolved === "dark";
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: "inherit",
          themeVariables: dark
            ? {
                background: "transparent",
                primaryColor: "#0a2341",
                primaryTextColor: "#f5f9ff",
                primaryBorderColor: "#2f7fd6",
                secondaryColor: "#0d2b4d",
                tertiaryColor: "#07203c",
                lineColor: "#4f9fe0",
                textColor: "#c4d3e6",
                nodeBorder: "#2f7fd6",
                clusterBkg: "rgba(18,168,255,0.06)",
                clusterBorder: "rgba(53,154,255,0.35)",
                edgeLabelBackground: "#061a31",
                actorBkg: "#0a2341",
                actorBorder: "#2f7fd6",
                actorTextColor: "#f5f9ff",
                signalColor: "#4f9fe0",
                signalTextColor: "#c4d3e6",
                noteBkgColor: "#13304f",
                noteTextColor: "#e4edf9",
                noteBorderColor: "#3d84c9",
                labelBoxBkgColor: "#0a2341",
                labelTextColor: "#f5f9ff",
                sequenceNumberColor: "#02101f",
              }
            : {
                background: "transparent",
                primaryColor: "#eaf4ff",
                primaryTextColor: "#0b2742",
                primaryBorderColor: "#4b9fe1",
                lineColor: "#2f7fd6",
                textColor: "#1d3b57",
              },
        });
        const { svg: out } = await mermaid.render(`m${Math.random().toString(36).slice(2)}`, chart);
        if (!cancelled) setSvg(out);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, resolved]);

  if (failed) {
    return (
      <span className="mt-5 block overflow-hidden rounded-xl border border-border bg-[#02101f]">
        <span className="block overflow-x-auto px-3.5 py-3">
          <code className="whitespace-pre font-mono text-[12.5px] leading-relaxed text-text-2">{chart}</code>
        </span>
      </span>
    );
  }

  return (
    <span className="mt-5 block overflow-x-auto rounded-xl border border-border bg-surface-2/40 p-4 text-center [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full">
      {svg ? <span dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="block py-6 text-[12.5px] text-text-3">Rendering diagram…</span>}
    </span>
  );
}
