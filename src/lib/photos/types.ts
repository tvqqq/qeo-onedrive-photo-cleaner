import type { PhotoTag } from "@/lib/tags/types";

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
  createdByUserName: string | null;
  createdByDeviceName: string | null;
  createdByDeviceId: string | null;
  createdByApplicationName: string | null;
  createdByApplicationId: string | null;
  modifiedByUserName: string | null;
  modifiedByDeviceName: string | null;
  modifiedByDeviceId: string | null;
  modifiedByApplicationName: string | null;
  modifiedByApplicationId: string | null;
  etag: string | null;
  quickxorHash: string | null;
  sha256: string | null;
  tags?: PhotoTag[];
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

export interface PhotoQuery {
  page: number;
  pageSize: number;
  sort: PhotoSort;
  search?: string;
  tagSlugs?: string[];
  mimeType?: string;
  category?: string;
  takenFrom?: number;
  takenTo?: number;
}

export interface PhotoPageResult {
  items: PhotoMetadata[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
