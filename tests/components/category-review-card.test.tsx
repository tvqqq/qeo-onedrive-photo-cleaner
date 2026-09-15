/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoMetadata } from "@/lib/photos/types";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.mock("@/components/photo-thumb", () => ({ PhotoThumb: () => <div data-testid="photo-thumb" /> }));

import { CategoryReviewCard } from "@/components/category-review-card";

const photo: PhotoMetadata = {
  photoId: "photo-1",
  driveItemId: "drive-1",
  name: "holiday.jpg",
  path: "/Camera/holiday.jpg",
  sizeBytes: 2_000_000,
  mimeType: "image/jpeg",
  width: 4032,
  height: 3024,
  takenAt: 1_788_000_000_000,
  remoteCreatedAt: null,
  remoteModifiedAt: null,
  cameraMake: "Apple",
  cameraModel: "iPhone 15 Pro",
  exposureNumerator: 1,
  exposureDenominator: 120,
  fNumber: 1.78,
  focalLength: 6.86,
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
  etag: "v1",
  quickxorHash: null,
  sha256: null,
  tags: [],
};

afterEach(cleanup);
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
});

describe("CategoryReviewCard", () => {
  it("shows photo metadata alongside category source and confidence", () => {
    render(<CategoryReviewCard
      photo={photo}
      selectedSlugs={["travel"]}
      labels={[{ slug: "travel", name: "Travel", source: "local-ai", confidence: 0.78 }]}
    />);

    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("4032 × 3024")).toBeTruthy();
    expect(screen.getByText(/iPhone 15 Pro/)).toBeTruthy();
    expect(screen.getByText(/local-ai/i)).toBeTruthy();
    expect(screen.getByText(/78%/)).toBeTruthy();
  });

  it("saves category differences as manual review", async () => {
    render(<CategoryReviewCard
      photo={photo}
      selectedSlugs={["travel"]}
      labels={[]}
    />);

    fireEvent.click(screen.getByLabelText("Family"));
    fireEvent.click(screen.getByLabelText("Travel"));
    fireEvent.click(screen.getByRole("button", { name: /save.*review/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init.body))).toEqual({
      action: "review",
      photoId: "photo-1",
      add: ["family"],
      remove: ["travel"],
      markReviewed: true,
    });
  });
});
