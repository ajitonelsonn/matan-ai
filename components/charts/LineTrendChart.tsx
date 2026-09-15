"use client";

import * as React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartTooltipBody, ChartLegend } from "./ChartTooltip";
import { chartColors } from "@/lib/utils/tones";

export interface TrendRow {
  day: string;
  people: number;
  vehicles: number;
  packages: number;
  security: number;
}

const series: { key: keyof TrendRow; name: string; color: string }[] = [
  { key: "people", name: "People Count", color: chartColors.people },
  { key: "vehicles", name: "Vehicle Count", color: chartColors.packages },
  { key: "packages", name: "Packages", color: chartColors.animals },
  { key: "security", name: "Security Events", color: chartColors.security },
];

export function BusinessTrendChart({ data, height = 260 }: { data: TrendRow[]; height?: number }) {
  return (
    <div>
      <div style={{ height }} role="img" aria-label="Business activity over the last 7 days">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chartColors.grid} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ stroke: "rgba(18,168,255,0.35)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as TrendRow;
                return <ChartTooltipBody title={`${label}, 2026`} rows={series.map((s) => ({ name: s.name, value: row[s.key] as number, color: s.color }))} />;
              }}
            />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: "var(--matan-surface)", fill: s.color }} activeDot={{ r: 5, stroke: "var(--matan-surface)", strokeWidth: 2 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={series} className="mt-3" />
    </div>
  );
}
