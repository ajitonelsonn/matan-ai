"use client";

import { Radio, FlaskConical } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";

export type DeviceSource = "ring" | "demo";

/** Explicit switch between real Ring Playground devices and local demo devices (spec §24). */
export function DeviceSourceSwitch({ value, onChange, ringCount }: { value: DeviceSource; onChange: (v: DeviceSource) => void; ringCount?: number }) {
  return (
    <Tabs
      variant="segmented"
      size="sm"
      value={value}
      onChange={onChange}
      aria-label="Device source"
      items={[
        { value: "ring", label: "Ring devices", icon: <Radio />, count: ringCount },
        { value: "demo", label: "Demo devices", icon: <FlaskConical /> },
      ]}
    />
  );
}
