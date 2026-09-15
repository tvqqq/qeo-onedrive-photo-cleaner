import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function runWorker(workerLane: string, waitMs = 1000) {
  const dataDir = await mkdtemp(join(tmpdir(), "qeo-worker-"));
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCommand, ["run", "worker"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_BASE_URL: "http://localhost:3000",
      DATA_DIR: dataDir,
      DEMO_MODE: "1",
      WORKER_LANE: workerLane,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

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
    }, waitMs);
  });

  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
  await rm(dataDir, { recursive: true, force: true });
  return { outcome, stderr };
}

describe("worker runtime", () => {
  it("stays running after startup with an explicit ML lane", async () => {
    const { outcome, stderr } = await runWorker("ml");
    expect(outcome, `worker exited during startup:\n${stderr}`).toBe("running");
  }, 10_000);

  it("rejects an invalid worker lane during startup", async () => {
    const { outcome } = await runWorker("other");
    expect(outcome).toBe("exited");
  }, 10_000);
});
