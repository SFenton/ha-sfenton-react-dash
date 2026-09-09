#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const installDir = path.dirname(fileURLToPath(import.meta.url));
const backendConfig = JSON.parse(
  await fs.readFile(path.join(installDir, 'backend-config.json'), 'utf8'),
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    path.join(installDir, 'node_modules', '@playwright', 'mcp', 'cli.js'),
    ...backendConfig.args,
  ],
  stderr: 'pipe',
});
const client = new Client(
  { name: 'playwright-mcp-lifecycle-installer', version: '1.0.0' },
  { capabilities: {} },
);

try {
  await client.connect(transport);
  const tools = await client.listTools();
  await fs.writeFile(
    path.join(installDir, 'tools-cache.json'),
    `${JSON.stringify(tools, null, 2)}\n`,
  );
} finally {
  await client.close().catch(async () => {
    await transport.close().catch(() => {});
  });
}
