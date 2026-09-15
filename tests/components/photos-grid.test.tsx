/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoMetadata } from "@/lib/photos/types";
import { PhotosGrid } from "@/components/photos-grid";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(cleanup);
beforeEach(() => fetchMock.mockReset());

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
  quickxorHash: "qxor-1",
  sha256: "sha-1",
  tags: [],
};

describe("PhotosGrid", () => {
  it("opens and closes the metadata dialog without route navigation", () => {
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

  it("keeps successful tag edits in visible state when the dialog is reopened", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      tag: {
        slug: "family",
        name: "Family",
        source: "manual",
        state: "active",
        confidence: null,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    render(<PhotosGrid photos={[photo]} />);

    fireEvent.click(screen.getByRole("button", { name: /open IMG_0001.JPG details/i }));
    fireEvent.change(screen.getByPlaceholderText(/add a tag/i), { target: { value: "Family" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(await screen.findByText("#Family")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /close details/i }));
    fireEvent.click(screen.getByRole("button", { name: /open IMG_0001.JPG details/i }));

    expect(screen.getByText("#Family")).toBeTruthy();
  });

  it("removes a successfully deleted photo from the current Library immediately", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    render(<PhotosGrid photos={[photo]} />);

    fireEvent.click(screen.getByRole("button", { name: /open IMG_0001.JPG details/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete photo/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("button", { name: /open IMG_0001.JPG details/i })).toBeNull();
    });
  });
});
