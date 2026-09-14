/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/photo-thumb", () => ({
  PhotoThumb: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

import { SimilarGroupCard } from "@/components/similar-group-card";

describe("SimilarGroupCard", () => {
  it("is explicitly heuristic and exposes no delete control", () => {
    render(<SimilarGroupCard confidence={0.96} items={[
      { photoId: "a", name: "a.jpg", path: "/a.jpg", sizeBytes: 100 },
      { photoId: "b", name: "b.jpg", path: "/b.jpg", sizeBytes: 120 },
    ]} />);

    expect(screen.getByText("Heuristic — review only")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/recycle bin/i)).toBeNull();
    expect(screen.getByText(/96/)).toBeTruthy();
  });
});
