import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const installDir = path.dirname(fileURLToPath(import.meta.url));

async function waitFor(predicate, message) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

async function readEvents(eventFile) {
  const content = await fs.readFile(eventFile, 'utf8').catch(() => '');
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('starts lazily and stops on close, idle, and client shutdown', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-mcp-lifecycle-'));
  const eventFile = path.join(tempDir, 'events.jsonl');
  const cacheFile = path.join(tempDir, 'tools.json');
  const tools = [
    {
      name: 'browser_navigate',
      description: 'Navigate',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'browser_close',
      description: 'Close',
      inputSchema: { type: 'object', properties: {} },
    },
  ];
  await fs.writeFile(cacheFile, JSON.stringify({ tools }));

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(installDir, 'server.mjs')],
    env: {
      ...process.env,
      PLAYWRIGHT_MCP_BACKEND_COMMAND: process.execPath,
      PLAYWRIGHT_MCP_BACKEND_ARGS: JSON.stringify([
        path.join(installDir, 'fake-backend.mjs'),
      ]),
      PLAYWRIGHT_MCP_TOOLS_CACHE: cacheFile,
      PLAYWRIGHT_MCP_IDLE_MS: '200',
      PLAYWRIGHT_MCP_TEST_EVENTS: eventFile,
    },
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'lifecycle-test', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    transport.stderr?.pipe(process.stderr);
    assert.deepEqual((await client.listTools()).tools, tools);
    assert.equal((await readEvents(eventFile)).length, 0);

    await Promise.all([
      client.callTool({ name: 'browser_navigate', arguments: {} }),
      client.callTool({ name: 'browser_navigate', arguments: {} }),
    ]);
    await waitFor(
      async () =>
        (await readEvents(eventFile)).filter(({ event }) => event === 'start')
          .length === 1,
      'concurrent calls started more than one backend',
    );

    await client.callTool({ name: 'browser_close', arguments: {} });
    await waitFor(
      async () =>
        (await readEvents(eventFile)).filter(({ event }) => event === 'stop')
          .length === 1,
      'backend did not stop after browser_close',
    );

    await client.callTool({ name: 'browser_navigate', arguments: {} });
    await waitFor(
      async () =>
        (await readEvents(eventFile)).filter(({ event }) => event === 'start')
          .length === 2,
      'backend did not restart',
    );
    await waitFor(
      async () =>
        (await readEvents(eventFile)).filter(({ event }) => event === 'stop')
          .length === 2,
      'backend did not stop after idle timeout',
    );

    await client.callTool({ name: 'browser_navigate', arguments: {} });
    await waitFor(
      async () =>
        (await readEvents(eventFile)).filter(({ event }) => event === 'start')
          .length === 3,
      'backend did not start before client shutdown',
    );
  } finally {
    await client.close();
  }

  await waitFor(
    async () =>
      (await readEvents(eventFile)).filter(({ event }) => event === 'stop')
        .length === 3,
    'backend did not stop with proxy client',
  );
});
