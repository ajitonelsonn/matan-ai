import { getStore, delay } from "@/lib/mock/store";
import { ok, notFound, readJson } from "@/lib/api/http";
import type { Device } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await delay(120);
  const { id } = await params;
  const d = getStore().devices.find((x) => x.id === id);
  return d ? ok(d) : notFound("Device not found");
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Partial<Pick<Device, "name" | "location" | "status">> & { settings?: Partial<Device["settings"]>; action?: "test" | "restart" }>(req);
  const d = getStore().devices.find((x) => x.id === id);
  if (!d) return notFound("Device not found");
  if (body.action) {
    await delay(900);
    return ok({ device: d, result: body.action === "test" ? "Device test completed" : "Device restarted" });
  }
  if (body.name) d.name = body.name;
  if (body.location) d.location = body.location;
  if (body.status) d.status = body.status;
  if (body.settings) d.settings = { ...d.settings, ...body.settings };
  return ok(d);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const s = getStore();
  const idx = s.devices.findIndex((x) => x.id === id);
  if (idx === -1) return notFound("Device not found");
  s.devices.splice(idx, 1);
  return ok({ deleted: id });
}
