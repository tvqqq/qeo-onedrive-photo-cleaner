import { execFileSync } from "node:child_process";
import { describe, it } from "vitest";

describe("temporary Tailwind lockfile generator", () => {
  it("prints the npm-generated package manifest diff for v0.2", () => {
    execFileSync("npm", [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-dev",
      "tailwindcss@4.1.13",
      "@tailwindcss/postcss@4.1.13",
    ], { stdio: "pipe" });
    const diff = execFileSync("git", ["diff", "--", "package.json", "package-lock.json"], { encoding: "utf8" });
    console.log("QEO_TAILWIND_DIFF_BEGIN");
    console.log(diff);
    console.log("QEO_TAILWIND_DIFF_END");
  }, 60_000);
});
