/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhotoMetadata } from "@/lib/photos/types";

vi.mock("@/components/photo-thumb", () => ({
  PhotoThumb: ({ alt }: { alt: string }) => <div data-testid="photo-thumb">{alt}</div>,
}));
vi.mock("@/components/photo-tags-editor", () => ({
  PhotoTagsEditor: () => <div data-testid="photo-tags-editor" />,
}));
vi.mock("@/components/album-picker", () => ({
  AlbumPicker: () => <div data-testid="album-picker" />,
}));
vi.mock("@/components/delete-photo-control", () => ({
  DeletePhotoControl: () => <div data-testid="delete-photo-control" />,
}));

import { PhotoDetailDialog } from "@/components/photo-detail-dialog";

afterEach(cleanup);

function photo(overrides: Partial<PhotoMetadata> = {}): PhotoMetadata {
  return {
    photoId: "photo-1",
    driveItemId: "drive-1",
    name: "IMG_0001.jpg",
    path: "/Pictures/IMG_0001.jpg",
    sizeBytes: 1_500_000,
    mimeType: "image/jpeg",
    width: 4032,
    height: 3024,
    takenAt: Date.parse("2026-08-01T03:00:00.000Z"),
    remoteCreatedAt: Date.parse("2026-08-01T03:01:00.000Z"),
    remoteModifiedAt: Date.parse("2026-08-01T03:02:00.000Z"),
    cameraMake: "Apple",
    cameraModel: "iPhone 16 Pro",
    exposureNumerator: 1,
    exposureDenominator: 120,
    fNumber: 1.8,
    focalLength: 24,
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
    quickxorHash: "quickxor-1",
    sha256: "sha256-1",
    tags: [],
    ...overrides,
  };
}

describe("PhotoDetailDialog", () => {
  it("shows only true OneDrive source identity fields when available", () => {
    render(
      <PhotoDetailDialog
        photo={photo({
          createdByUserName: "Quyen",
          createdByDeviceName: "Qeo iPhone",
          createdByApplicationName: "OneDrive iOS",
          modifiedByUserName: "Quyen",
          modifiedByDeviceName: "Qeo Mac",
          modifiedByApplicationName: "OneDrive macOS",
        })}
        onClose={vi.fn()}
        onTagsChange={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByText("Uploaded/created by")).toBeTruthy();
    expect(screen.getByText("Qeo iPhone · OneDrive iOS · Quyen")).toBeTruthy();
    expect(screen.getByText("Last modified by")).toBeTruthy();
    expect(screen.getByText("Qeo Mac · OneDrive macOS · Quyen")).toBeTruthy();
    expect(screen.getByText("ETag")).toBeTruthy();
    expect(screen.getByText("etag-1")).toBeTruthy();
  });

  it("omits source identity rows instead of inferring them from camera or filename", () => {
    render(
      <PhotoDetailDialog
        photo={photo()}
        onClose={vi.fn()}
        onTagsChange={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.queryByText("Uploaded/created by")).toBeNull();
    expect(screen.queryByText("Last modified by")).toBeNull();
    expect(screen.getByText("Apple iPhone 16 Pro")).toBeTruthy();
    expect(screen.getByText("IMG_0001.jpg")).toBeTruthy();
  });
});
