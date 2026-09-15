"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltipBody } from "./ChartTooltip";

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function DonutChart({ data, size = 160, thickness = 22, center, ariaLabel }: { data: DonutSlice[]; size?: number; thickness?: number; center?: React.ReactNode; ariaLabel?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel ?? `Donut chart, ${total} total`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={size / 2 - thickness}
            outerRadius={size / 2 - 2}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="var(--matan-surface)"
            strokeWidth={2}
            cornerRadius={4}
            isAnimationActive={false}
            animationDuration={600}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as DonutSlice;
              return <ChartTooltipBody rows={[{ name: p.name, value: `${p.value} (${total ? Math.round((p.value / total) * 100) : 0}%)`, color: p.color }]} />;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  );
}
