import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("validateRoutingPolicy enforces reviewer and delegate relationships when configured", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mission-control-routing-policy-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tempRoot);
    await mkdir(path.join(tempRoot, "data"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "data", "team.json"),
      JSON.stringify(
        [
          {
            id: "henry",
            canDelegateTo: ["codex"],
          },
          {
            id: "ralph",
            canReviewFor: ["codex"],
          },
        ],
        null,
        2
      ),
      "utf-8"
    );

    const { validateRoutingPolicy } = await import("@/lib/agent-routing-policy");

    assert.equal(
      await validateRoutingPolicy({
        ownerAgentId: "henry",
        handoffToAgentId: "ralph",
      }),
      "henry is not configured to delegate work to ralph."
    );

    assert.equal(
      await validateRoutingPolicy({
        ownerAgentId: "henry",
        reviewerAgentId: "ralph",
      }),
      "ralph is not configured to review work for henry."
    );

    assert.equal(
      await validateRoutingPolicy({
        ownerAgentId: "codex",
        reviewerAgentId: "ralph",
      }),
      null
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
});
