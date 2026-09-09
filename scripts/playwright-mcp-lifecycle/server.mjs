#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const installDir = path.dirname(fileURLToPath(import.meta.url));
const backendCommand =
  process.env.PLAYWRIGHT_MCP_BACKEND_COMMAND ?? process.execPath;
const backendArgs = process.env.PLAYWRIGHT_MCP_BACKEND_ARGS
  ? JSON.parse(process.env.PLAYWRIGHT_MCP_BACKEND_ARGS)
  : await loadInstalledBackendArgs();
const toolsCachePath =
  process.env.PLAYWRIGHT_MCP_TOOLS_CACHE ??
  path.join(installDir, 'tools-cache.json');
const idleTimeoutMs = Number.parseInt(
  process.env.PLAYWRIGHT_MCP_IDLE_MS ?? '600000',
  10,
);
const backendEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry) => entry[1] !== undefined),
);

async function loadInstalledBackendArgs() {
  const backendConfig = JSON.parse(
    await fs.readFile(path.join(installDir, 'backend-config.json'), 'utf8'),
  );
  return [
    path.join(installDir, 'node_modules', '@playwright', 'mcp', 'cli.js'),
    ...backendConfig.args,
  ];
}

if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs < 0) {
  throw new Error('PLAYWRIGHT_MCP_IDLE_MS must be a non-negative integer');
}

const cachedTools = JSON.parse(await fs.readFile(toolsCachePath, 'utf8'));
const server = new Server(
  { name: 'playwright-mcp-lifecycle', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

let backend = null;
let backendStartPromise = null;
let lifecycleTail = Promise.resolve();
let idleTimer = null;
let activeCalls = 0;
let closeRequested = false;
let shuttingDown = false;

function withLifecycleLock(operation) {
  const result = lifecycleTail.then(operation, operation);
  lifecycleTail = result.catch(() => {});
  return result;
}

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

async function startBackend() {
  if (backend) {
    return backend;
  }
  if (backendStartPromise) {
    return backendStartPromise;
  }

  backendStartPromise = withLifecycleLock(async () => {
    if (backend) {
      return backend;
    }

    const transport = new StdioClientTransport({
      command: backendCommand,
      args: backendArgs,
      env: backendEnv,
      stderr: 'pipe',
    });
    const client = new Client(
      { name: 'playwright-mcp-lifecycle', version: '1.0.0' },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);
      transport.stderr?.pipe(process.stderr);
      backend = { client, transport };
      client.onclose = () => {
        if (backend?.client === client) {
          backend = null;
        }
      };
      return backend;
    } catch (error) {
      await transport.close().catch(() => {});
      throw error;
    }
  });

  try {
    return await backendStartPromise;
  } finally {
    backendStartPromise = null;
  }
}

async function stopBackend({ force = false } = {}) {
  clearIdleTimer();
  await withLifecycleLock(async () => {
    if (!backend) {
      return;
    }
    if (activeCalls > 0 && !force) {
      scheduleIdleStop();
      return;
    }

    const current = backend;
    backend = null;
    closeRequested = false;
    await current.client.close().catch(async () => {
      await current.transport.close().catch(() => {});
    });
  });
}

function scheduleIdleStop() {
  clearIdleTimer();
  if (idleTimeoutMs === 0) {
    void stopBackend();
    return;
  }
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void stopBackend();
  }, idleTimeoutMs);
  idleTimer.unref();
}

server.setRequestHandler(ListToolsRequestSchema, async () => cachedTools);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  clearIdleTimer();
  const current = await startBackend();
  activeCalls += 1;

  try {
    return await current.client.callTool(request.params);
  } finally {
    activeCalls -= 1;
    if (request.params.name === 'browser_close') {
      closeRequested = true;
    }
    if (closeRequested && activeCalls === 0) {
      await stopBackend();
    } else {
      scheduleIdleStop();
    }
  }
});

async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearIdleTimer();
  await stopBackend({ force: true });
  await server.close().catch(() => {});
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}

process.stdin.on('end', () => {
  void shutdown();
});
process.on('uncaughtException', (error) => {
  console.error(error);
  void shutdown().finally(() => process.exit(1));
});
process.on('unhandledRejection', (error) => {
  console.error(error);
  void shutdown().finally(() => process.exit(1));
});

await server.connect(new StdioServerTransport());
