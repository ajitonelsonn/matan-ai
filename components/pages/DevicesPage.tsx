"use client";

import * as React from "react";
import { DemoDevicesView } from "./DemoDevicesView";
import { RingDevicesView } from "@/components/devices/ring-devices-view";
import { DeviceSourceSwitch, type DeviceSource } from "@/components/devices/device-source-switch";
import { AddRingDeviceModal } from "@/components/devices/add-ring-device-modal";
import { ringApi } from "@/lib/api/ring";
import { useApi } from "@/hooks/useApi";
import { useAppMode } from "@/components/experience/experience-provider";

const STORAGE_KEY = "matan.devices.source";

/**
 * Devices page container.
 * Source of truth is the Ring Playground connection. Demo devices are an explicit,
 * clearly labelled opt-in and never a silent fallback for a failed Ring connection.
 */
export function DevicesPage({ initialDeviceId }: { initialDeviceId?: string }) {
  const ringQ = useApi(() => ringApi.devices(), []);
  const appMode = useAppMode();
  const [source, setSource] = React.useState<DeviceSource | null>(null);
  // Follow the global mode by default (Real -> Ring view, Demo -> Demo view); the local toggle can still override.
  const lastMode = React.useRef(appMode);
  React.useEffect(() => {
    if (lastMode.current !== appMode) {
      lastMode.current = appMode;
      setSource(appMode === "ring" ? "ring" : "demo");
    }
  }, [appMode]);
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
    setSource(isRingId ? "ring" : isDemoId ? "demo" : appMode === "ring" ? "ring" : connected.length > 0 && stored !== "demo" ? "ring" : stored === "ring" ? "ring" : "demo");
  }, [ringQ.loading, ringQ.data, initialDeviceId, source, appMode]);

  const choose = (s: DeviceSource) => {
    setSource(s);
    try {
      localStorage.setItem(STORAGE_KEY, s);
    } catch {
      /* ignore */
    }
  };

  // Real Mode shows Ring devices only - no demo switch, no demo fallback.
  const isRing = appMode === "ring";
  const sourceSwitch = isRing ? null : <DeviceSourceSwitch value={source ?? "ring"} onChange={choose} ringCount={ringCount} />;

  if (source === "demo" && !isRing) {
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

  return <RingDevicesView initialDeviceId={initialDeviceId} sourceSwitch={sourceSwitch} onBrowseDemo={isRing ? undefined : () => choose("demo")} onConnectedChange={setRingCount} />;
}
