/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncAlbumButton } from "@/components/sync-album-button";

afterEach(() => vi.unstubAllGlobals());

describe("SyncAlbumButton", () => {
  it("syncs one reviewed category and reports added items", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      albumId: "album-family",
      added: 3,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<SyncAlbumButton categoryId="family" categoryName="Family" />);
    fireEvent.click(screen.getByRole("button", { name: /sync family album/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({
      action: "sync-album",
      categoryId: "family",
    });
    expect(await screen.findByText(/3 photo/i)).toBeTruthy();
  });
});
