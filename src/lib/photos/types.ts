export interface PhotoMetadata {
  photoId: string;
  driveItemId: string;
  name: string;
  path: string;
  sizeBytes: number;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  takenAt: number | null;
  remoteCreatedAt: number | null;
  remoteModifiedAt: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  exposureNumerator: number | null;
  exposureDenominator: number | null;
  fNumber: number | null;
  focalLength: number | null;
  iso: number | null;
  orientation: number | null;
  etag: string | null;
  quickxorHash: string | null;
  sha256: string | null;
}

export type PhotoSort =
  | "taken-desc"
  | "taken-asc"
  | "modified-desc"
  | "modified-asc"
  | "size-desc"
  | "size-asc"
  | "name-asc"
  | "name-desc";
