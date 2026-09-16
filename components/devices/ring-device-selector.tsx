"use client";

import * as React from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RingDeviceCard } from "./ring-device-card";
import type { RingDiscoveredDevice } from "@/lib/ring/types";

export function RingDeviceSelector({ devices, selected, onChange }: { devices: RingDiscoveredDevice[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const [search, setSearch] = React.useState("");
  const filtered = devices.filter((d) => !search.trim() || `${d.name} ${d.model ?? ""} ${d.type}`.toLowerCase().includes(search.trim().toLowerCase()));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-text-2" aria-live="polite">
          <span className="font-semibold text-text">{devices.length}</span> {devices.length === 1 ? "device" : "devices"} found
          <span className="text-text-3"> · </span>
          <span className="font-semibold text-primary">{selected.size}</span> selected
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => onChange(new Set(devices.map((d) => d.id)))} disabled={selected.size === devices.length}>
            Select all
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onChange(new Set())} disabled={selected.size === 0}>
            Clear
          </Button>
        </div>
      </div>
      {devices.length > 3 && <SearchInput value={search} onChange={setSearch} placeholder="Search devices…" size="sm" aria-label="Search discovered devices" />}
      {filtered.length === 0 ? (
        <EmptyState compact title="No devices match" description="Try a different search." />
      ) : (
        <ul className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
          {filtered.map((d, i) => (
            <li key={d.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <RingDeviceCard device={d} selected={selected.has(d.id)} onToggle={() => toggle(d.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
