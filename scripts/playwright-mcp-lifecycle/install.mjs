#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const homeDir = os.homedir();
const installDir = path.join(
  homeDir,
  '.local',
  'share',
  'playwright-mcp-lifecycle',
);
const launcherPath = path.join(
  homeDir,
  '.local',
  'bin',
  'playwright-mcp-lifecycle',
);
const mcpConfigPath = path.join(homeDir, '.copilot', 'mcp-config.json');
const files = [
  'package.json',
  'package-lock.json',
  'server.mjs',
  'refresh-tools.mjs',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
  return result;
}

async function readCurrentPlaywrightEntry() {
  try {
    const config = JSON.parse(await fs.readFile(mcpConfigPath, 'utf8'));
    return config.mcpServers?.playwright ?? null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function resolveBackendArgs(currentEntry) {
  const installedConfigPath = path.join(installDir, 'backend-config.json');
  if (currentEntry?.command?.endsWith('playwright-mcp-lifecycle')) {
    try {
      const installed = JSON.parse(
        await fs.readFile(installedConfigPath, 'utf8'),
      );
      if (Array.isArray(installed.args)) {
        return installed.args;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const args = Array.isArray(currentEntry?.args) ? currentEntry.args : [];
  const packageIndex = args.findIndex((arg) =>
    arg.startsWith('@playwright/mcp'),
  );
  const backendArgs = packageIndex >= 0 ? args.slice(packageIndex + 1) : [];
  if (backendArgs.length === 0) {
    backendArgs.push('--headless');
    const executablePath = await findInstalledChromium();
    if (executablePath) {
      backendArgs.push('--executable-path', executablePath);
    }
  }
  if (!backendArgs.includes('--no-sandbox')) {
    backendArgs.push('--no-sandbox');
  }
  return backendArgs;
}

async function findInstalledChromium() {
  const cacheDir = path.join(homeDir, '.cache', 'ms-playwright');
  const browsers = JSON.parse(
    await fs.readFile(
      path.join(installDir, 'node_modules', 'playwright-core', 'browsers.json'),
      'utf8',
    ),
  );
  const expectedRevision = browsers.browsers.find(
    (browser) => browser.name === 'chromium',
  )?.revision;
  let entries;
  try {
    entries = await fs.readdir(cacheDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const orderedEntries = [
    ...(expectedRevision ? [`chromium-${expectedRevision}`] : []),
    ...entries
    .filter((entry) => /^chromium-\d+$/.test(entry))
      .sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true }),
      ),
  ].filter((entry, index, all) => all.indexOf(entry) === index);
  const candidates = orderedEntries
    .flatMap((entry) => [
      path.join(cacheDir, entry, 'chrome-linux64', 'chrome'),
      path.join(cacheDir, entry, 'chrome-linux', 'chrome'),
    ]);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return null;
}

await fs.mkdir(installDir, { recursive: true });
await fs.mkdir(path.dirname(launcherPath), { recursive: true });
for (const file of files) {
  await fs.copyFile(path.join(sourceDir, file), path.join(installDir, file));
}

run('npm', ['ci', '--omit=dev', '--quiet'], { cwd: installDir });

const currentEntry = await readCurrentPlaywrightEntry();
const backendArgs = await resolveBackendArgs(currentEntry);
await fs.writeFile(
  path.join(installDir, 'backend-config.json'),
  `${JSON.stringify({ args: backendArgs }, null, 2)}\n`,
  { mode: 0o600 },
);
await fs.writeFile(
  launcherPath,
  `#!/bin/sh\nexec /usr/bin/env node ${JSON.stringify(path.join(installDir, 'server.mjs'))}\n`,
  { mode: 0o755 },
);
await fs.chmod(launcherPath, 0o755);

run(process.execPath, [path.join(installDir, 'refresh-tools.mjs')]);

let backupPath = null;
try {
  await fs.access(mcpConfigPath);
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  backupPath = `${mcpConfigPath}.playwright-lifecycle-backup-${timestamp}`;
  await fs.copyFile(mcpConfigPath, backupPath);
  await fs.chmod(backupPath, 0o600);
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

try {
  const existing = run('copilot', ['mcp', 'get', 'playwright'], {
    capture: true,
    allowFailure: true,
  });
  if (existing.status === 0) {
    run('copilot', ['mcp', 'remove', 'playwright']);
  }
  run('copilot', [
    'mcp',
    'add',
    '--tools',
    '*',
    'playwright',
    '--',
    launcherPath,
  ]);
} catch (error) {
  if (backupPath) {
    await fs.copyFile(backupPath, mcpConfigPath);
    await fs.chmod(mcpConfigPath, 0o600);
  }
  throw error;
}

console.log(`Installed Playwright MCP lifecycle proxy at ${installDir}`);
if (backupPath) {
  console.log(`Backed up Copilot MCP configuration to ${backupPath}`);
}
