import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("worker runtime", () => {
  it("stays running after startup instead of exiting during tsx transform", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "qeo-worker-"));
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npmCommand, ["run", "worker"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_BASE_URL: "http://localhost:3000",
        DATA_DIR: dataDir,
        DEMO_MODE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    try {
      const outcome = await new Promise<"running" | "exited">((resolve) => {
        let settled = false;

        child.once("exit", () => {
          if (!settled) {
            settled = true;
            resolve("exited");
          }
        });

        setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve("running");
          }
        }, 1000);
      });

      expect(outcome, `worker exited during startup:\n${stderr}`).toBe("running");
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await new Promise<void>((resolve) => child.once("exit", () => resolve()));
      }
      await rm(dataDir, { recursive: true, force: true });
    }
  }, 10_000);
});
