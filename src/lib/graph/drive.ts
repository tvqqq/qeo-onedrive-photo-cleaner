import { GraphClient } from "./client";
import type {
  DeltaPage,
  DriveAlbum,
  GraphCollectionResponse,
  GraphDeltaResponse,
  GraphDriveItem,
} from "./types";

const DELTA_SELECT = [
  "id",
  "name",
  "size",
  "eTag",
  "createdDateTime",
  "lastModifiedDateTime",
  "createdBy",
  "lastModifiedBy",
  "file",
  "folder",
  "photo",
  "image",
  "parentReference",
  "deleted",
].join(",");

const INITIAL_DELTA_PATH = `/me/drive/root/delta?$select=${DELTA_SELECT}`;
const ALBUMS_PATH = "/drive/bundles?$filter=bundle/album ne null&$select=id,name,bundle";

function itemPath(itemId: string) {
  return `/me/drive/items/${encodeURIComponent(itemId)}`;
}

export class DriveApi {
  constructor(private readonly graph: GraphClient) {}

  async getDeltaPage(url?: string): Promise<DeltaPage> {
    const response = await this.graph.json<GraphDeltaResponse>(url ?? INITIAL_DELTA_PATH);
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

  async listAlbums(): Promise<DriveAlbum[]> {
    const albums: DriveAlbum[] = [];
    let next: string | undefined = ALBUMS_PATH;
    while (next) {
      const response: GraphCollectionResponse<GraphDriveItem> =
        await this.graph.json<GraphCollectionResponse<GraphDriveItem>>(next);
      for (const item of response.value ?? []) {
        if (!item.bundle?.album || !item.id || !item.name?.trim()) continue;
        albums.push({ id: item.id, name: item.name });
      }
      next = response["@odata.nextLink"];
    }
    return albums.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id),
    );
  }

  async listAlbumItemIds(albumId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    let next: string | undefined = `/drive/bundles/${encodeURIComponent(albumId)}/children?$select=id`;
    while (next) {
      const response: GraphCollectionResponse<GraphDriveItem> =
        await this.graph.json<GraphCollectionResponse<GraphDriveItem>>(next);
      for (const item of response.value ?? []) {
        if (item.id) ids.add(item.id);
      }
      next = response["@odata.nextLink"];
    }
    return ids;
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
