/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/photos" }));

import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("renders the persistent product navigation and marks the current route", () => {
    render(<AppShell><div>Page content</div></AppShell>);

    for (const name of ["Dashboard", "Photos", "Scan", "Duplicates", "Categories", "Settings"]) {
      expect(screen.getByRole("link", { name })).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "Photos" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Page content")).toBeTruthy();
  });
});
