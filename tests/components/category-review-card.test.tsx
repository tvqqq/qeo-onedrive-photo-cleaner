/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.mock("@/components/photo-thumb", () => ({ PhotoThumb: ({ alt }: { alt: string }) => <span>{alt}</span> }));

import { CategoryReviewCard } from "@/components/category-review-card";

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
});

describe("CategoryReviewCard", () => {
  it("shows category source and confidence", () => {
    render(<CategoryReviewCard
      photo={{ photoId: "photo-1", name: "holiday.jpg", path: "/Camera/holiday.jpg" }}
      selectedSlugs={["travel"]}
      labels={[{ slug: "travel", name: "Travel", source: "local-ai", confidence: 0.78 }]}
    />);

    expect(screen.getByText(/local-ai/i)).toBeTruthy();
    expect(screen.getByText(/78%/)).toBeTruthy();
  });

  it("saves category differences as manual review", async () => {
    render(<CategoryReviewCard
      photo={{ photoId: "photo-1", name: "holiday.jpg", path: "/Camera/holiday.jpg" }}
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
