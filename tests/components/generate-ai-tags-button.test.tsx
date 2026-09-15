/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { GenerateAiTagsButton } from "@/components/generate-ai-tags-button";

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("GenerateAiTagsButton", () => {
  it("queues the shared tag job and renders its id", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ jobId: "job-tags-1" }), {
      status: 202,
      headers: { "content-type": "application/json" },
    }));

    render(<GenerateAiTagsButton />);
    fireEvent.click(screen.getByRole("button", { name: /generate ai tags/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/photos/action");
    expect(JSON.parse(String(init.body))).toEqual({ action: "generate-tags" });
    expect(await screen.findByText(/job-tags-1/i)).toBeTruthy();
  });

  it("renders the API error and re-enables the trigger", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "ML queue unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    }));

    render(<GenerateAiTagsButton />);
    fireEvent.click(screen.getByRole("button", { name: /generate ai tags/i }));

    expect(await screen.findByText("ML queue unavailable")).toBeTruthy();
    expect((screen.getByRole("button", { name: /generate ai tags/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
