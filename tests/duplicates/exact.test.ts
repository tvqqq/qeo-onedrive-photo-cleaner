import { describe, expect, it } from "vitest";
import { computeSha256, verifyExactCandidateGroup } from "@/lib/duplicates/exact";

function streamOf(value: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

const candidates = [
  { id: "a", driveItemId: "a", sizeBytes: 4, quickxorHash: "same", etag: "a1", name: "a.jpg", path: "/a.jpg" },
  { id: "b", driveItemId: "b", sizeBytes: 4, quickxorHash: "same", etag: "b1", name: "b.jpg", path: "/b.jpg" },
];

describe("exact duplicate verification", () => {
  it("computes sha256 from a stream without persisting original bytes", async () => {
    expect(await computeSha256(streamOf("AAAA"))).toHaveLength(64);
  });

  it("does not verify a quickxor candidate group when streamed bytes differ", async () => {
    const result = await verifyExactCandidateGroup(
      candidates,
      async (id) => streamOf(id === "a" ? "AAAA" : "BBBB"),
    );
    expect(result).toBeNull();
  });

  it("verifies candidates only when all streamed sha256 digests match", async () => {
    const result = await verifyExactCandidateGroup(candidates, async () => streamOf("AAAA"));
    expect(result?.items).toHaveLength(2);
    expect(result?.sha256).toHaveLength(64);
  });
});
