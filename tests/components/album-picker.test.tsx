/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlbumPicker } from "@/components/album-picker";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
});

function albumResponse() {
  return new Response(JSON.stringify({
    albums: [
      { id: "album-family", name: "Family" },
      { id: "album-travel", name: "Travel 2026" },
    ],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("AlbumPicker", () => {
  it("loads existing albums only when opened and filters them locally", async () => {
    fetchMock.mockResolvedValue(albumResponse());
    render(<AlbumPicker photoId="photo-1" />);

    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /add to album/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/albums");
    expect(await screen.findByRole("option", { name: "Family" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Travel 2026" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/search albums/i), { target: { value: "travel" } });
    expect(screen.queryByRole("option", { name: "Family" })).toBeNull();
    expect(screen.getByRole("option", { name: "Travel 2026" })).toBeTruthy();
  });

  it("adds using only photoId and selected albumId", async () => {
    fetchMock
      .mockResolvedValueOnce(albumResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ added: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    render(<AlbumPicker photoId="photo-1" />);
    fireEvent.click(screen.getByRole("button", { name: /add to album/i }));
    await screen.findByRole("option", { name: "Family" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "album-family" } });
    fireEvent.click(screen.getByRole("button", { name: /add photo/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe("/api/photos/action");
    expect(JSON.parse(String(init.body))).toEqual({
      action: "add-to-album",
      photoId: "photo-1",
      albumId: "album-family",
    });
    expect((await screen.findByText("Added to Family")).textContent).toBe("Added to Family");
  });

  it("treats repeated membership as success and surfaces API errors inline", async () => {
    fetchMock
      .mockResolvedValueOnce(albumResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ added: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    render(<AlbumPicker photoId="photo-1" />);
    fireEvent.click(screen.getByRole("button", { name: /add to album/i }));
    await screen.findByRole("option", { name: "Family" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "album-family" } });
    fireEvent.click(screen.getByRole("button", { name: /add photo/i }));
    expect((await screen.findByText("Already in album")).textContent).toBe("Already in album");

    cleanup();
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ error: "OneDrive unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    }));
    render(<AlbumPicker photoId="photo-1" />);
    fireEvent.click(screen.getByRole("button", { name: /add to album/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("OneDrive unavailable");
  });
});
