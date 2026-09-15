"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DriveAlbum } from "@/lib/graph/types";

export function AlbumPicker({ photoId }: { photoId: string }) {
  const [open, setOpen] = useState(false);
  const [albums, setAlbums] = useState<DriveAlbum[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? albums.filter((album) => album.name.toLocaleLowerCase().includes(needle)) : albums;
  }, [albums, query]);

  async function loadAlbums() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/albums");
      const body = await response.json() as { albums?: DriveAlbum[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to load albums");
      setAlbums(body.albums ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load albums");
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await loadAlbums();
  }

  async function add() {
    const album = albums.find((item) => item.id === selected);
    if (!album) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/photos/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "add-to-album", photoId, albumId: album.id }),
      });
      const body = await response.json() as { added?: boolean; error?: string };
      if (!response.ok || typeof body.added !== "boolean") {
        throw new Error(body.error ?? "Unable to add photo to album");
      }
      setMessage(body.added ? `Added to ${album.name}` : "Already in album");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add photo to album");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" onClick={() => void toggle()}>
        {open ? "Hide albums" : "Add to album"}
      </Button>
      {open ? (
        <div className="space-y-2 rounded-xl border border-zinc-900 bg-black/20 p-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search existing albums…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400"
          />
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">{loading ? "Loading…" : "Choose an existing album"}</option>
            {filtered.map((album) => <option key={album.id} value={album.id}>{album.name}</option>)}
          </select>
          <Button type="button" variant="primary" disabled={!selected || busy || loading} onClick={() => void add()}>
            {busy ? "Adding…" : "Add photo"}
          </Button>
        </div>
      ) : null}
      {message ? <p role="status" className="text-xs text-zinc-400">{message}</p> : null}
    </div>
  );
}
