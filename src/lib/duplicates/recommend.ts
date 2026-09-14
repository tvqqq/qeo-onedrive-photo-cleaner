export interface KeepCandidate {
  id: string;
  driveItemId: string;
  name: string;
  path: string;
  remoteCreatedAt?: number | null;
}

function copyPenalty(name: string): number {
  const value = name.toLowerCase();
  return /(\(\d+\)|\bcopy\b|\bduplicate\b|[-_ ]copy\.)/.test(value) ? 1 : 0;
}

function pathPenalty(path: string): number {
  return /\/(downloads?|temp|recovered)(\/|$)/i.test(path) ? 1 : 0;
}

export function recommendKeep(items: KeepCandidate[]): string {
  if (items.length === 0) throw new Error("Cannot recommend a keeper for an empty group");
  return [...items].sort((a, b) => {
    const copy = copyPenalty(a.name) - copyPenalty(b.name);
    if (copy !== 0) return copy;
    const path = pathPenalty(a.path) - pathPenalty(b.path);
    if (path !== 0) return path;
    const created = (a.remoteCreatedAt ?? Number.MAX_SAFE_INTEGER) - (b.remoteCreatedAt ?? Number.MAX_SAFE_INTEGER);
    if (created !== 0) return created;
    return a.driveItemId.localeCompare(b.driveItemId);
  })[0]!.id;
}
