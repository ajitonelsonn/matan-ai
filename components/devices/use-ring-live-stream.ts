"use client";

import * as React from "react";
import { ringApi, ringErrorFrom } from "@/lib/api/ring";

export type LiveStreamState = "idle" | "connecting" | "live" | "ended" | "error";

/**
 * WebRTC (WHEP) live view for a connected Ring device.
 * Browser creates an SDP offer -> Matan backend forwards it to Ring with the
 * session token -> Ring's SDP answer is applied -> video plays via <video>.
 */
export function useRingLiveStream(deviceId: string | null, videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = React.useState<LiveStreamState>("idle");
  const [error, setError] = React.useState<{ title: string; message: string } | null>(null);
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const sessionRef = React.useRef<string | null>(null);

  const cleanup = React.useCallback(() => {
    pcRef.current?.getReceivers().forEach((r) => r.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  const stop = React.useCallback(async () => {
    const id = deviceId;
    const url = sessionRef.current;
    sessionRef.current = null;
    cleanup();
    setState("ended");
    setStartedAt(null);
    if (id && url) await ringApi.stopStream(id, url).catch(() => undefined);
  }, [cleanup, deviceId]);

  const start = React.useCallback(async () => {
    if (!deviceId || state === "connecting") return;
    setError(null);
    setState("connecting");
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] });
      pcRef.current = pc;
      // Same m-line order as Ring's reference app (audio, then video).
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0];
          void videoRef.current.play().catch(() => undefined);
          setState("live");
          setStartedAt((t) => t ?? Date.now());
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          setError({ title: "Stream connection failed", message: "The WebRTC connection to Ring dropped. Try again." });
          setState("error");
          cleanup();
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "closed") {
          if (pcRef.current === pc) setState((s) => (s === "live" ? "ended" : s));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Wait for ICE gathering (max 3s) so the offer carries candidates.
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const t = setTimeout(resolve, 3000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(t);
            resolve();
          }
        };
      });

      const { sdpAnswer, sessionUrl } = await ringApi.startStream(deviceId, pc.localDescription!.sdp);
      sessionRef.current = sessionUrl;
      await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });
    } catch (e) {
      const ring = ringErrorFrom(e);
      const raw = e instanceof Error ? e.message : "";
      const webrtc = /setRemoteDescription|sdp|ICE|RTCPeerConnection/i.test(raw);
      setError(
        ring
          ? { title: ring.title, message: ring.message }
          : webrtc
            ? { title: "Couldn't negotiate the stream", message: "Ring answered, but the browser couldn't apply the stream description. Start a simulation in the Playground and try again." }
            : { title: "Couldn't start live view", message: raw || "Please try again." },
      );
      setState("error");
      cleanup();
    }
  }, [deviceId, state, videoRef, cleanup]);

  // Stop when the device changes or the component unmounts.
  React.useEffect(() => {
    return () => {
      const url = sessionRef.current;
      sessionRef.current = null;
      cleanup();
      if (deviceId && url) void ringApi.stopStream(deviceId, url).catch(() => undefined);
    };
  }, [deviceId, cleanup]);

  return { state, error, start, stop, startedAt };
}
