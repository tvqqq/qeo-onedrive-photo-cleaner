"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PhotoTag } from "@/lib/tags/types";

export function PhotoTagsEditor({
  photoId,
  tags,
  onTagsChange,
}: {
  photoId: string;
  tags: PhotoTag[];
  onTagsChange(tags: PhotoTag[]): void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mutate(action: "add-tag" | "remove-tag", tagName: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/photos/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, photoId, tag: tagName }),
      });
      const body = await response.json() as { tag?: PhotoTag; error?: string };
      if (!response.ok || !body.tag) throw new Error(body.error ?? "Unable to update tag");
      const next = tags.filter((tag) => tag.slug !== body.tag?.slug);
      if (body.tag.state === "active") next.push(body.tag);
      onTagsChange(next.sort((a, b) => a.name.localeCompare(b.name)));
      if (action === "add-tag") setInput("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update tag");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? <span className="text-sm text-zinc-500">No tags yet.</span> : null}
        {tags.map((tag) => (
          <span key={tag.slug} className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-200">
            <span>#{tag.name}</span>
            <span className="text-zinc-500" title={tag.source === "ai" ? "AI tag" : "Manual tag"}>
              {tag.source === "ai" ? "AI" : "Manual"}
            </span>
            <button
              type="button"
              disabled={busy}
              aria-label={`Remove ${tag.name}`}
              onClick={() => void mutate("remove-tag", tag.name)}
              className="text-zinc-500 hover:text-red-300 disabled:opacity-50"
            >×</button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim()) void mutate("add-tag", input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Add a tag…"
          maxLength={80}
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400"
        />
        <Button type="submit" variant="secondary" disabled={busy || !input.trim()}>Add</Button>
      </form>
      {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
