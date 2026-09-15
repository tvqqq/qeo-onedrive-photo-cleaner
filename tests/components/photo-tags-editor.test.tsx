/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoTagsEditor } from "@/components/photo-tags-editor";
import type { PhotoTag } from "@/lib/tags/types";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
});

const screenshotTag: PhotoTag = {
  slug: "screenshot",
  name: "Screenshot",
  source: "ai",
  state: "active",
  confidence: 0.91,
};

const familyTag: PhotoTag = {
  slug: "family",
  name: "Family",
  source: "manual",
  state: "active",
  confidence: null,
};

describe("PhotoTagsEditor", () => {
  it("adds a manual tag and updates the parent only after API success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ tag: familyTag }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const onTagsChange = vi.fn();

    render(<PhotoTagsEditor photoId="photo-1" tags={[screenshotTag]} onTagsChange={onTagsChange} />);
    fireEvent.change(screen.getByPlaceholderText(/add a tag/i), { target: { value: "Family" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/photos/action");
    expect(JSON.parse(String(init.body))).toEqual({
      action: "add-tag",
      photoId: "photo-1",
      tag: "Family",
    });
    expect(onTagsChange).toHaveBeenCalledWith([familyTag, screenshotTag]);
  });

  it("removes a tag only after the server returns a removed override", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      tag: { ...screenshotTag, source: "manual", state: "removed", confidence: null },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const onTagsChange = vi.fn();

    render(<PhotoTagsEditor photoId="photo-1" tags={[screenshotTag, familyTag]} onTagsChange={onTagsChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove screenshot/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init.body))).toEqual({
      action: "remove-tag",
      photoId: "photo-1",
      tag: "Screenshot",
    });
    expect(onTagsChange).toHaveBeenCalledWith([familyTag]);
  });

  it("keeps parent state unchanged and renders the API error on failure", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Photo is not available" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));
    const onTagsChange = vi.fn();

    render(<PhotoTagsEditor photoId="photo-1" tags={[screenshotTag]} onTagsChange={onTagsChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove screenshot/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Photo is not available");
    expect(onTagsChange).not.toHaveBeenCalled();
  });
});
