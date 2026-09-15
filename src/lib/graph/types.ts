export interface GraphIdentity {
  id?: string;
  displayName?: string;
}

export interface GraphIdentitySet {
  user?: GraphIdentity;
  device?: GraphIdentity;
  application?: GraphIdentity;
}

export interface GraphDriveItem {
  id: string;
  name?: string;
  size?: number;
  eTag?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  createdBy?: GraphIdentitySet;
  lastModifiedBy?: GraphIdentitySet;
  file?: {
    mimeType?: string;
    hashes?: { quickXorHash?: string };
  };
  folder?: { childCount?: number };
  bundle?: {
    album?: Record<string, unknown>;
    childCount?: number;
  };
  image?: {
    width?: number;
    height?: number;
  };
  photo?: {
    width?: number;
    height?: number;
    takenDateTime?: string;
    cameraMake?: string;
    cameraModel?: string;
    exposureNumerator?: number;
    exposureDenominator?: number;
    fNumber?: number;
    focalLength?: number;
    iso?: number;
    orientation?: number;
  };
  parentReference?: { id?: string };
  deleted?: { state?: string };
}

export interface DriveAlbum {
  id: string;
  name: string;
}

export interface GraphCollectionResponse<T> {
  value?: T[];
  "@odata.nextLink"?: string;
}

export interface DeltaPage {
  items: GraphDriveItem[];
  nextLink?: string;
  deltaLink?: string;
}

export interface GraphDeltaResponse {
  value: GraphDriveItem[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}
