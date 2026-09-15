/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobProgress } from "@/components/job-progress";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("JobProgress", () => {
  it("tracks full scan mode and never invents a percentage when total is unknown", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "job-1",
        status: "running",
        progressCurrent: 12,
        progressTotal: null,
        error: null,
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "job-1",
        status: "completed",
        progressCurrent: 25,
        progressTotal: null,
        error: null,
      }), { status: 200, headers: { "content-type": "application/json" } }));

    render(<JobProgress />);
    fireEvent.click(screen.getByRole("button", { name: "Full scan" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, postInit] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(postInit.body))).toEqual({ mode: "full" });
    expect(screen.getByText("Mode")).toBeTruthy();
    expect(screen.getAllByText("Full scan")).toHaveLength(2);
    expect(screen.getByText("running")).toBeTruthy();
    expect(screen.getByText(/Processed 12/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+%/);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3), { timeout: 2000 });
    expect(screen.getByText("completed")).toBeTruthy();
    expect(screen.getByText(/Processed 25/)).toBeTruthy();
  });

  it("renders the scan API error message", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Microsoft account disconnected" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));

    render(<JobProgress />);
    fireEvent.click(screen.getByRole("button", { name: "Incremental scan" }));

    expect(await screen.findByText("Microsoft account disconnected")).toBeTruthy();
  });
});
