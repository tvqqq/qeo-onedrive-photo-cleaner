/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { ClassifyPhotosButton } from "@/components/classify-photos-button";

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ jobId: "job-classify" }), {
    status: 202,
    headers: { "content-type": "application/json" },
  }));
});

it("queues local classification", async () => {
  render(<ClassifyPhotosButton />);
  fireEvent.click(screen.getByRole("button", { name: /run local classification/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/categories/action");
  expect(JSON.parse(String(init.body))).toEqual({ action: "classify" });
  expect(await screen.findByText(/job-classify/)).toBeTruthy();
});
