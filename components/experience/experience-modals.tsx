"use client";

import { AddRingDeviceModal } from "@/components/devices/add-ring-device-modal";
import { useExperience } from "./experience-provider";

/** Global Connect/Reconnect Ring modal, driven by the experience provider. */
export function ExperienceModals() {
  const { connectOpen, closeConnect, connectThenMode, ring, setMode } = useExperience();
  return (
    <AddRingDeviceModal
      open={connectOpen}
      onClose={closeConnect}
      existingSession={ring.session}
      alreadyConnectedIds={ring.connected.map((d) => d.ringDeviceId)}
      onConnected={(connected, session) => {
        ring.setData({ connected, session });
        if (connectThenMode) setMode(connectThenMode);
      }}
    />
  );
}
