/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PhotoMetadata } from "@/lib/photos/types";

vi.mock("@/components/photo-thumb", () => ({ PhotoThumb: () => <div data-testid="photo-thumb" /> }));

import { SimilarGroupCard } from "@/components/similar-group-card";

function photo(photoId: string, name: string): PhotoMetadata {
  return {
    photoId,
    driveItemId: `drive-${photoId}`,
    name,
    path: `/Camera/${name}`,
    sizeBytes: 4_718_592,
    mimeType: "image/jpeg",
    width: 4032,
    height: 3024,
    takenAt: Date.UTC(2026, 0, 2),
    remoteCreatedAt: Date.UTC(2026, 0, 2),
    remoteModifiedAt: Date.UTC(2026, 0, 2),
    cameraMake: "Apple",
    cameraModel: "iPhone 15 Pro",
    exposureNumerator: 1,
    exposureDenominator: 120,
    fNumber: 1.78,
    focalLength: 24,
    iso: 80,
    orientation: 1,
    etag: `etag-${photoId}`,
    quickxorHash: null,
    sha256: null,
  };
}

describe("SimilarGroupCard", () => {
  it("shows rich metadata while remaining heuristic and mutation-free", () => {
    render(<SimilarGroupCard confidence={0.96} items={[
      { photo: photo("a", "a.jpg") },
      { photo: photo("b", "b.jpg") },
    ]} />);

    expect(screen.getByText("Heuristic — review only")).toBeTruthy();
    expect(screen.getAllByText(/iPhone 15 Pro/)).toHaveLength(2);
    expect(screen.getAllByText("4032 × 3024")).toHaveLength(2);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/recycle bin/i)).toBeNull();
    expect(screen.getByText(/96/)).toBeTruthy();
  });
});
