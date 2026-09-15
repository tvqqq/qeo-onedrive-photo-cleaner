/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PhotoMetadata } from "@/lib/photos/types";
import { PhotosGrid } from "@/components/photos-grid";

const photo: PhotoMetadata = {
  photoId: "photo-1",
  driveItemId: "drive-1",
  name: "IMG_0001.JPG",
  path: "/Camera Roll/IMG_0001.JPG",
  sizeBytes: 4_718_592,
  mimeType: "image/jpeg",
  width: 4032,
  height: 3024,
  takenAt: Date.UTC(2026, 0, 2, 3, 4),
  remoteCreatedAt: Date.UTC(2026, 0, 2, 3, 5),
  remoteModifiedAt: Date.UTC(2026, 0, 2, 3, 6),
  cameraMake: "Apple",
  cameraModel: "iPhone 15 Pro",
  exposureNumerator: 1,
  exposureDenominator: 120,
  fNumber: 1.78,
  focalLength: 24,
  iso: 80,
  orientation: 1,
  etag: "etag-1",
  quickxorHash: "qxor-1",
  sha256: "sha-1",
};

describe("PhotosGrid", () => {
  it("opens and closes a read-only metadata dialog without route navigation", () => {
    render(<PhotosGrid photos={[photo]} />);

    fireEvent.click(screen.getByRole("button", { name: /open IMG_0001.JPG details/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("ISO 80")).toBeTruthy();
    expect(screen.getByText("f/1.78")).toBeTruthy();
    expect(screen.getByText("1/120s")).toBeTruthy();
    expect(screen.getByText("sha-1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /close details/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
