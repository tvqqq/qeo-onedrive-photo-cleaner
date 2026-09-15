import { describe, expect, it, vi } from "vitest";
import { DriveApi } from "@/lib/graph/drive";
import type { GraphClient } from "@/lib/graph/client";

describe("DriveApi", () => {
  it("preserves Graph nextLink and deltaLink verbatim while selecting photo facets initially", async () => {
    const json = vi.fn().mockResolvedValue({
      value: [{ id: "1", name: "photo.jpg" }],
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/next?a=b",
      "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?token=opaque",
    });
    const drive = new DriveApi({ json } as unknown as GraphClient);

    const page = await drive.getDeltaPage();

    expect(json).toHaveBeenCalledWith(expect.stringContaining("/me/drive/root/delta?$select="));
    expect(String(json.mock.calls[0]![0])).toContain("photo");
    expect(String(json.mock.calls[0]![0])).toContain("image");
    expect(page.nextLink).toBe("https://graph.microsoft.com/v1.0/next?a=b");
    expect(page.deltaLink).toBe("https://graph.microsoft.com/v1.0/delta?token=opaque");

    await drive.getDeltaPage(page.nextLink);
    expect(json).toHaveBeenNthCalledWith(2, page.nextLink);
  });

  it("uses If-Match for reviewed recycle-bin deletion", async () => {
    const json = vi.fn().mockResolvedValue(undefined);
    const drive = new DriveApi({ json } as unknown as GraphClient);

    await drive.deleteItem("item-1", "etag-1");

    expect(json).toHaveBeenCalledWith("/me/drive/items/item-1", {
      method: "DELETE",
      headers: { "If-Match": "etag-1" },
    });
  });

  it("creates an album with initial items using the bundle API", async () => {
    const json = vi.fn().mockResolvedValue({ id: "album-1" });
    const drive = new DriveApi({ json } as unknown as GraphClient);

    const id = await drive.createAlbum("Travel", ["photo-1", "photo-2"]);

    expect(id).toBe("album-1");
    expect(json).toHaveBeenCalledWith("/drive/bundles", {
      method: "POST",
      body: JSON.stringify({
        name: "Travel",
        "@microsoft.graph.conflictBehavior": "rename",
        bundle: { album: {} },
        children: [{ id: "photo-1" }, { id: "photo-2" }],
      }),
      headers: { "content-type": "application/json" },
    });
  });

  it("adds existing items to an album one Graph request per item", async () => {
    const json = vi.fn().mockResolvedValue(undefined);
    const drive = new DriveApi({ json } as unknown as GraphClient);

    await drive.addAlbumItems("album-1", ["photo-3", "photo-4"]);

    expect(json).toHaveBeenNthCalledWith(1, "/drive/bundles/album-1/children", {
      method: "POST",
      body: JSON.stringify({ id: "photo-3" }),
      headers: { "content-type": "application/json" },
    });
    expect(json).toHaveBeenNthCalledWith(2, "/drive/bundles/album-1/children", {
      method: "POST",
      body: JSON.stringify({ id: "photo-4" }),
      headers: { "content-type": "application/json" },
    });
  });
});
