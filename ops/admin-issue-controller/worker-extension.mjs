import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { joinSession } from "@github/copilot-sdk/extension";

const MAX_OUTPUT_BYTES = 512 * 1024;
const READ_ONLY_WORKSPACE_PATHS = [
  ".env",
  ".env.development",
  ".git",
  ".github",
  ".gitattributes",
  ".gitignore",
  ".gitmodules",
  "eslint.config.js",
  "node_modules",
  "ops/admin-issue-controller",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "scripts/admin-issue-controller.test.ts",
  "scripts/admin-issue-controller.ts",
  "scripts/design-system",
  "scripts/e2e-coverage-check.ts",
  "scripts/i18n",
  "scripts/lib/adminIssueController.ts",
  "scripts/lib/hassAdminTodo.test.ts",
  "scripts/lib/hassAdminTodo.ts",
  "scripts/test-change-policy.ts",
  "tsconfig.app.json",
  "tsconfig.json",
  "tsconfig.node.json",
  "tsconfig.validation.json",
  "vite.config.ts",
  "vitest.config.ts",
];

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function removeContainer(name) {
  await new Promise((resolve) => {
    const child = spawn("docker", ["rm", "--force", name], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: "ignore",
    });
    child.once("close", resolve);
    child.once("error", resolve);
  });
}

async function runIsolated(command, timeoutSeconds) {
  const image = requiredEnvironment("ADMIN_ISSUE_WORKER_IMAGE");
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) {
    return {
      textResultForLlm: "The worker image must be configured by immutable image ID.",
      resultType: "failure",
    };
  }

  const workspace = await realpath(process.cwd());
  const configuredWorkspace = await realpath(
    requiredEnvironment("ADMIN_ISSUE_WORKSPACE"),
  );
  if (workspace !== configuredWorkspace || workspace.includes(",")) {
    return {
      textResultForLlm: "The worker workspace binding is invalid.",
      resultType: "failure",
    };
  }
  const configuredGitCommonDirectory = requiredEnvironment(
    "ADMIN_ISSUE_GIT_COMMON_DIR",
  );
  if (!isAbsolute(configuredGitCommonDirectory)) {
    return {
      textResultForLlm: "The Git common directory must be an absolute path.",
      resultType: "failure",
    };
  }
  const gitCommonDirectory = await realpath(configuredGitCommonDirectory);
  if (gitCommonDirectory.includes(",")) {
    return {
      textResultForLlm: "The Git common directory binding is invalid.",
      resultType: "failure",
    };
  }

  const name = `admin-issue-worker-${randomUUID()}`;
  const uid = process.getuid();
  const gid = process.getgid();
  const readOnlyMounts = [];
  for (const relativePath of READ_ONLY_WORKSPACE_PATHS) {
    const source = `${workspace}/${relativePath}`;
    try {
      await access(source);
      readOnlyMounts.push(
        "--mount",
        `type=bind,src=${source},dst=/workspace/${relativePath},readonly`,
      );
    } catch {
      // Missing paths remain covered by the controller's post-run validation.
    }
  }
  const args = [
    "run",
    "--rm",
    "--name",
    name,
    "--label",
    "com.sfenton.admin-issue-controller=true",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--pids-limit",
    "768",
    "--memory",
    "6g",
    "--cpus",
    "6",
    "--shm-size",
    "2g",
    "--user",
    `${uid}:${gid}`,
    "--workdir",
    "/workspace",
    "--mount",
    `type=bind,src=${workspace},dst=/workspace`,
    ...readOnlyMounts,
    "--mount",
    `type=bind,src=${gitCommonDirectory},dst=${gitCommonDirectory},readonly`,
    "--tmpfs",
    `/tmp:rw,nosuid,nodev,size=2g,uid=${uid},gid=${gid}`,
    "--tmpfs",
    `/home/worker:rw,nosuid,nodev,size=128m,uid=${uid},gid=${gid}`,
    "--tmpfs",
    `/workspace/node_modules/.vite-temp:rw,nosuid,nodev,size=256m,uid=${uid},gid=${gid}`,
    "--env",
    "CI=1",
    "--env",
    "HOME=/home/worker",
    "--env",
    "NO_COLOR=1",
    "--entrypoint",
    "/bin/bash",
    image,
    "-lc",
    command,
  ];

  return await new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    let truncated = false;
    const child = spawn("docker", args, {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const append = (chunk) => {
      if (truncated) return;
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) {
        output = output.slice(0, MAX_OUTPUT_BYTES);
        truncated = true;
        child.kill("SIGTERM");
      }
    };

    child.stdout.on("data", append);
    child.stderr.on("data", append);

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutSeconds * 1000);

    child.once("error", async (error) => {
      clearTimeout(timeout);
      await removeContainer(name);
      resolve({
        textResultForLlm: `Container launch failed: ${error.message}`,
        resultType: "failure",
      });
    });

    child.once("close", async (code) => {
      clearTimeout(timeout);
      if (timedOut || truncated) await removeContainer(name);
      const suffix = truncated ? "\n[output truncated]" : "";
      const text = `${output}${suffix}`.trim() || `(exit ${code ?? "unknown"}, no output)`;
      resolve({
        textResultForLlm: text,
        resultType: code === 0 && !timedOut && !truncated ? "success" : "failure",
      });
    });
  });
}

await joinSession({
  tools: [
    {
      name: "admin_issue_workspace",
      description:
        "Read, edit, and test the assigned repository worktree inside a networkless container. Only the worktree and its read-only Git metadata are mounted from the host.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Bash command to run inside the isolated worktree.",
          },
          timeout_seconds: {
            type: "integer",
            minimum: 1,
            maximum: 1800,
            default: 300,
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
      handler: async ({ command, timeout_seconds = 300 }) =>
        await runIsolated(command, timeout_seconds),
    },
  ],
});
