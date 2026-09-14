import { GraphClient } from "./client";
import type { DeltaPage, GraphDeltaResponse, GraphDriveItem } from "./types";

function itemPath(itemId: string) {
  return `/me/drive/items/${encodeURIComponent(itemId)}`;
}

export class DriveApi {
  constructor(private readonly graph: GraphClient) {}

  async getDeltaPage(url?: string): Promise<DeltaPage> {
    const response = await this.graph.json<GraphDeltaResponse>(url ?? "/me/drive/root/delta");
    return {
      items: response.value ?? [],
      nextLink: response["@odata.nextLink"],
      deltaLink: response["@odata.deltaLink"],
    };
  }

  async getThumbnailContent(itemId: string, size = "large"): Promise<ArrayBuffer> {
    const stream = await this.graph.stream(
      `${itemPath(itemId)}/thumbnails/0/${encodeURIComponent(size)}/content`,
    );
    return new Response(stream).arrayBuffer();
  }

  openContent(itemId: string): Promise<ReadableStream<Uint8Array>> {
    return this.graph.stream(`${itemPath(itemId)}/content`);
  }

  getItem(itemId: string): Promise<GraphDriveItem> {
    return this.graph.json<GraphDriveItem>(itemPath(itemId));
  }

  async deleteItem(itemId: string, ifMatch?: string): Promise<void> {
    await this.graph.json(itemPath(itemId), {
      method: "DELETE",
      ...(ifMatch ? { headers: { "If-Match": ifMatch } } : {}),
    });
  }

  async createAlbum(name: string, itemIds: string[] = []): Promise<string> {
    const album = await this.graph.json<GraphDriveItem>("/drive/bundles", {
      method: "POST",
      body: JSON.stringify({
        name,
        "@microsoft.graph.conflictBehavior": "rename",
        bundle: { album: {} },
        children: itemIds.map((id) => ({ id })),
      }),
      headers: { "content-type": "application/json" },
    });
    if (!album?.id) throw new Error("Microsoft Graph did not return an album id");
    return album.id;
  }

  async addAlbumItems(albumId: string, itemIds: string[]): Promise<void> {
    for (const itemId of itemIds) {
      await this.graph.json(`/drive/bundles/${encodeURIComponent(albumId)}/children`, {
        method: "POST",
        body: JSON.stringify({ id: itemId }),
        headers: { "content-type": "application/json" },
      });
    }
  }
}
