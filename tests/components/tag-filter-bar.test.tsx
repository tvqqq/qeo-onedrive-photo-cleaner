/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/photos",
  search: "q=invoice%20%23document&mime=image%2Fjpeg&category=family&page=3&sort=newest",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

import { TagFilterBar } from "@/components/tag-filter-bar";

const tags = [
  { slug: "document", name: "Document", count: 12 },
  { slug: "screenshot", name: "Screenshot", count: 9 },
];

function pushedParams() {
  expect(navigation.push).toHaveBeenCalledTimes(1);
  const target = navigation.push.mock.calls[0]?.[0] as string;
  const url = new URL(target, "http://localhost:3000");
  return url.searchParams;
}

afterEach(cleanup);

describe("TagFilterBar", () => {
  beforeEach(() => {
    navigation.push.mockReset();
    navigation.pathname = "/photos";
    navigation.search = "q=invoice%20%23document&mime=image%2Fjpeg&category=family&page=3&sort=newest";
  });

  it("adds a tag while preserving free text, active tags, and unrelated filters", () => {
    render(<TagFilterBar tags={tags} />);

    fireEvent.click(screen.getByRole("button", { name: /screenshot/i }));

    const params = pushedParams();
    expect(params.get("q")).toBe("invoice #document #screenshot");
    expect(params.get("mime")).toBe("image/jpeg");
    expect(params.get("category")).toBe("family");
    expect(params.get("sort")).toBe("newest");
    expect(params.get("page")).toBe("1");
  });

  it("removes only the active tag and preserves the rest of the query", () => {
    navigation.search = "q=invoice%20%23document%20%23screenshot&mime=image%2Fjpeg&category=family&page=4&sort=newest";
    render(<TagFilterBar tags={tags} />);

    fireEvent.click(screen.getByRole("button", { name: /document/i }));

    const params = pushedParams();
    expect(params.get("q")).toBe("invoice #screenshot");
    expect(params.get("mime")).toBe("image/jpeg");
    expect(params.get("category")).toBe("family");
    expect(params.get("sort")).toBe("newest");
    expect(params.get("page")).toBe("1");
  });
});
