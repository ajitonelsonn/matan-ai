"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartTooltipBody, ChartLegend } from "./ChartTooltip";
import { chartColors } from "@/lib/utils/tones";
import type { DailyTrendPoint } from "@/lib/types";

const series: { key: keyof DailyTrendPoint; name: string; color: string }[] = [
  { key: "people", name: "People", color: chartColors.people },
  { key: "packages", name: "Packages", color: chartColors.packages },
  { key: "vehicles", name: "Vehicles", color: chartColors.vehicles },
  { key: "animals", name: "Animals", color: chartColors.animals },
  { key: "others", name: "Others", color: chartColors.others },
];

export function EventTrendsChart({ data, height = 260 }: { data: DailyTrendPoint[]; height?: number }) {
  const many = data.length > 10;
  return (
    <div>
      <ChartLegend items={series} className="mb-3 justify-end" />
      <div style={{ height }} role="img" aria-label="Daily event count by type">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap={many ? "20%" : "32%"}>
            <CartesianGrid vertical={false} stroke={chartColors.grid} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} interval={many ? Math.ceil(data.length / 8) - 1 : 0} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(18,168,255,0.06)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as DailyTrendPoint;
                return (
                  <ChartTooltipBody
                    title={`${label}, 2026`}
                    rows={series.map((s) => ({ name: s.name, value: point[s.key] as number, color: s.color }))}
                    total={point.total}
                  />
                );
              }}
            />
            {series.map((s, idx) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="a"
                fill={s.color}
                stroke="var(--matan-surface)"
                strokeWidth={1}
                radius={idx === series.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={44}
                isAnimationActive={false}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
