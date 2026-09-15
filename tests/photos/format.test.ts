import { describe, expect, it } from "vitest";
import {
  formatAperture,
  formatBytes,
  formatCamera,
  formatDateTime,
  formatDimensions,
  formatExposure,
  formatFocalLength,
  formatSourceIdentity,
} from "@/lib/photos/format";

describe("photo metadata formatting", () => {
  it("formats common photo metadata compactly", () => {
    expect(formatBytes(4_718_592)).toBe("4.50 MB");
    expect(formatDimensions(4032, 3024)).toBe("4032 × 3024");
    expect(formatDimensions(null, 3024)).toBeNull();
    expect(formatCamera("Apple", "iPhone 15 Pro")).toBe("Apple iPhone 15 Pro");
    expect(formatCamera(null, "Pixel 10")).toBe("Pixel 10");
    expect(formatAperture(1.78)).toBe("f/1.78");
    expect(formatExposure(1, 120)).toBe("1/120s");
    expect(formatExposure(2, 1)).toBe("2s");
    expect(formatFocalLength(24)).toBe("24 mm");
  });

  it("formats only Graph-provided source identity parts without duplicates", () => {
    expect(formatSourceIdentity({
      deviceName: "iPhone",
      applicationName: "OneDrive",
      userName: "Quyen",
    })).toBe("iPhone · OneDrive · Quyen");
    expect(formatSourceIdentity({
      deviceName: null,
      applicationName: "OneDrive",
      userName: null,
    })).toBe("OneDrive");
    expect(formatSourceIdentity({
      deviceName: "OneDrive",
      applicationName: "onedrive",
      userName: "Quyen",
    })).toBe("OneDrive · Quyen");
    expect(formatSourceIdentity({
      deviceName: null,
      applicationName: null,
      userName: null,
    })).toBeNull();
  });

  it("omits missing values instead of producing placeholder noise", () => {
    expect(formatCamera(null, null)).toBeNull();
    expect(formatAperture(null)).toBeNull();
    expect(formatExposure(null, null)).toBeNull();
    expect(formatFocalLength(null)).toBeNull();
    expect(formatDateTime(null)).toBeNull();
  });
});
