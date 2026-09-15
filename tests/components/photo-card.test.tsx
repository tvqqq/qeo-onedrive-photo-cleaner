/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PhotoMetadata } from "@/lib/photos/types";

vi.mock("@/components/photo-thumb", () => ({
  PhotoThumb: () => <div data-testid="photo-thumb" />,
}));

import { PhotoCard } from "@/components/photo-card";

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
  focalLength: null,
  iso: 80,
  orientation: 1,
  createdByUserName: null,
  createdByDeviceName: null,
  createdByDeviceId: null,
  createdByApplicationName: null,
  createdByApplicationId: null,
  modifiedByUserName: null,
  modifiedByDeviceName: null,
  modifiedByDeviceId: null,
  modifiedByApplicationName: null,
  modifiedByApplicationId: null,
  etag: "etag-1",
  quickxorHash: null,
  sha256: null,
};

describe("PhotoCard", () => {
  it("shows compact available metadata and omits missing values", () => {
    render(<PhotoCard photo={photo} />);

    expect(screen.getByText("IMG_0001.JPG")).toBeTruthy();
    expect(screen.getByText("4032 × 3024")).toBeTruthy();
    expect(screen.getByText("4.50 MB")).toBeTruthy();
    expect(screen.getByText(/iPhone 15 Pro/)).toBeTruthy();
    expect(screen.getByText(/Jan 2, 2026/)).toBeTruthy();
    expect(screen.queryByText(/N\/A/i)).toBeNull();
    expect(screen.queryByText(/focal length/i)).toBeNull();
  });
});
