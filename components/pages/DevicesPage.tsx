"use client";

import * as React from "react";
import { DemoDevicesView } from "./DemoDevicesView";
import { RingDevicesView } from "@/components/devices/ring-devices-view";
import { DeviceSourceSwitch, type DeviceSource } from "@/components/devices/device-source-switch";
import { AddRingDeviceModal } from "@/components/devices/add-ring-device-modal";
import { ringApi } from "@/lib/api/ring";
import { useApi } from "@/hooks/useApi";

const STORAGE_KEY = "matan.devices.source";

/**
 * Devices page container.
 * Source of truth is the Ring Playground connection. Demo devices are an explicit,
 * clearly labelled opt-in and never a silent fallback for a failed Ring connection.
 */
export function DevicesPage({ initialDeviceId }: { initialDeviceId?: string }) {
  const ringQ = useApi(() => ringApi.devices(), []);
  const [source, setSource] = React.useState<DeviceSource | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [ringCount, setRingCount] = React.useState<number | undefined>(undefined);

  // Decide the initial source once Ring state is known.
  React.useEffect(() => {
    if (source || ringQ.loading || !ringQ.data) return;
    const connected = ringQ.data.connected;
    setRingCount(connected.length);
    const isRingId = initialDeviceId ? connected.some((d) => d.id === initialDeviceId) : false;
    const isDemoId = initialDeviceId ? /^(cam-|chime-|dev-)/.test(initialDeviceId) : false;
    let stored: DeviceSource | null = null;
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as DeviceSource | null) ?? null;
    } catch {
      /* ignore */
    }
    setSource(isRingId ? "ring" : isDemoId ? "demo" : connected.length > 0 ? "ring" : stored === "demo" ? "demo" : "ring");
  }, [ringQ.loading, ringQ.data, initialDeviceId, source]);

  const choose = (s: DeviceSource) => {
    setSource(s);
    try {
      localStorage.setItem(STORAGE_KEY, s);
    } catch {
      /* ignore */
    }
  };

  const sourceSwitch = <DeviceSourceSwitch value={source ?? "ring"} onChange={choose} ringCount={ringCount} />;

  if (source === "demo") {
    return (
      <>
        <DemoDevicesView initialDeviceId={initialDeviceId} onAddRing={() => setAddOpen(true)} sourceSwitch={sourceSwitch} />
        <AddRingDeviceModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          existingSession={ringQ.data?.session ?? null}
          alreadyConnectedIds={(ringQ.data?.connected ?? []).map((d) => d.ringDeviceId)}
          onConnected={(connected) => {
            setRingCount(connected.length);
            void ringQ.refetch({ silent: true });
            choose("ring");
          }}
        />
      </>
    );
  }

  return <RingDevicesView initialDeviceId={initialDeviceId} sourceSwitch={sourceSwitch} onBrowseDemo={() => choose("demo")} onConnectedChange={setRingCount} />;
}
