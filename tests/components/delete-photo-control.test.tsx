/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeletePhotoControl } from "@/components/delete-photo-control";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("DeletePhotoControl", () => {
  it("requires explicit confirmation before any delete request", () => {
    render(<DeletePhotoControl photoId="photo-1" filename="IMG_0001.jpg" onDeleted={vi.fn()} />);

    expect(screen.getByText(/recycle bin/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /delete photo/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/IMG_0001\.jpg/i)).toBeTruthy();
    expect(screen.getByText(/recycle bin/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeTruthy();
  });

  it("sends only the local photoId and removes the item after confirmed success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const onDeleted = vi.fn();

    render(<DeletePhotoControl photoId="photo-1" filename="IMG_0001.jpg" onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: /delete photo/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/photos/action");
    expect(JSON.parse(String(init.body))).toEqual({ action: "delete", photoId: "photo-1" });
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledWith("photo-1");
  });

  it("keeps confirmation open and surfaces the API error without removing the photo", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Photo changed in OneDrive; refresh before deleting" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));
    const onDeleted = vi.fn();

    render(<DeletePhotoControl photoId="photo-1" filename="IMG_0001.jpg" onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: /delete photo/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("Photo changed in OneDrive");
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
