import type { DeltaPage, GraphDriveItem } from "@/lib/graph/types";
import type { ScanDriveApi } from "./service";

const demoItems: GraphDriveItem[] = [
  { id: "demo-folder", name: "Demo Photos", folder: {} },
  {
    id: "demo-family", name: "family-trip.jpg", size: 1_250_000, eTag: "demo-family-v1",
    parentReference: { id: "demo-folder" },
    file: { mimeType: "image/jpeg", hashes: { quickXorHash: "demo-qxor-family" } },
    photo: { width: 1920, height: 1080, takenDateTime: "2026-01-01T08:00:00Z" },
  },
  {
    id: "demo-copy", name: "family-trip-copy.jpg", size: 1_250_000, eTag: "demo-copy-v1",
    parentReference: { id: "demo-folder" },
    file: { mimeType: "image/jpeg", hashes: { quickXorHash: "demo-qxor-family" } },
    photo: { width: 1920, height: 1080, takenDateTime: "2026-01-01T08:00:00Z" },
  },
];

const DEMO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export class DemoDriveApi implements ScanDriveApi {
  async getDeltaPage(): Promise<DeltaPage> {
    return { items: demoItems, deltaLink: "https://graph.microsoft.com/v1.0/me/drive/root/delta?token=demo" };
  }

  async getThumbnailContent(): Promise<ArrayBuffer> {
    return DEMO_PNG.buffer.slice(
      DEMO_PNG.byteOffset,
      DEMO_PNG.byteOffset + DEMO_PNG.byteLength,
    ) as ArrayBuffer;
  }
}
