/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhotoThumb } from "@/components/photo-thumb";

describe("PhotoThumb", () => {
  it("keeps a neutral placeholder when the local thumbnail fails", () => {
    render(<PhotoThumb photoId="photo one" alt="IMG_0001.JPG" />);

    const image = screen.getByRole("img", { name: "IMG_0001.JPG" });
    expect(image.getAttribute("src")).toBe("/api/thumbnails/photo%20one");

    fireEvent.error(image);

    expect(screen.getByText("Thumbnail unavailable")).toBeTruthy();
    expect(screen.queryByRole("img", { name: "IMG_0001.JPG" })).toBeNull();
  });
});
