/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoMetadata } from "@/lib/photos/types";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.mock("@/components/photo-thumb", () => ({ PhotoThumb: () => <div data-testid="photo-thumb" /> }));

import { DuplicateGroupCard } from "@/components/duplicate-group-card";

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
    quickxorHash: "qxor",
    sha256: "same-sha",
  };
}

afterEach(cleanup);
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ deleted: 1 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
});

describe("DuplicateGroupCard", () => {
  it("keeps the recommended item protected and submits only reviewed non-keepers", async () => {
    render(<DuplicateGroupCard
      groupId="exact-1"
      verifiedSha256="same-sha"
      items={[
        { photo: photo("keeper", "keeper.jpg"), recommendedKeep: true, selectedForDelete: false },
        { photo: photo("copy", "copy.jpg"), recommendedKeep: false, selectedForDelete: false },
      ]}
    />);

    expect(screen.getByText("Recommended keep")).toBeTruthy();
    expect(screen.getByText(/Verified SHA-256/i)).toBeTruthy();
    expect(screen.getAllByText(/iPhone 15 Pro/)).toHaveLength(2);
    expect(screen.getAllByText("4032 × 3024")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.queryByRole("checkbox", { name: /keeper/i })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /copy.jpg/i }));
    fireEvent.click(screen.getByRole("button", { name: /approve 1 deletion/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init.body))).toEqual({
      action: "delete",
      groupId: "exact-1",
      selectedPhotoIds: ["copy"],
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/OneDrive Recycle Bin/i);
  });
});
