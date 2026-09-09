#!/usr/bin/env node

import fs from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const eventFile = process.env.PLAYWRIGHT_MCP_TEST_EVENTS;
const record = (event) => {
  fs.appendFileSync(eventFile, `${JSON.stringify({ event, pid: process.pid })}\n`);
};

record('start');

const server = new Server(
  { name: 'fake-playwright', version: '1.0.0' },
  { capabilities: { tools: {} } },
);
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

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [{ type: 'text', text: `called ${request.params.name}` }],
}));

let stopping = false;
async function shutdown() {
  if (stopping) {
    return;
  }
  stopping = true;
  record('stop');
  await server.close().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
process.stdin.on('end', () => void shutdown());

await server.connect(new StdioServerTransport());
