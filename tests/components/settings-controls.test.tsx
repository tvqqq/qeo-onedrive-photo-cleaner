/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsControls } from "@/components/settings-controls";

afterEach(() => vi.unstubAllGlobals());

describe("SettingsControls", () => {
  it("saves thresholds and clears only thumbnail cache", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ removedFiles: 4 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsControls dhashThreshold={8} clipThreshold={0.94} />);

    fireEvent.change(screen.getByLabelText(/dhash threshold/i), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText(/clip threshold/i), { target: { value: "0.96" } });
    fireEvent.click(screen.getByRole("button", { name: /save thresholds/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({
      action: "update-thresholds",
      dhashThreshold: 6,
      clipThreshold: 0.96,
    });

    fireEvent.click(screen.getByRole("button", { name: /clear thumbnail cache/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]!.body))).toEqual({ action: "clear-thumbnails" });
    expect(await screen.findByText(/4 thumbnail/i)).toBeTruthy();
  });
});
