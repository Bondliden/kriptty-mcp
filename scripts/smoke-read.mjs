#!/usr/bin/env node
// Read-only smoke test: starts the built server with KRIPTTY_READ_ONLY=1 (write tools are not even
// registered), checks that only read tools are exposed and calls each of them over MCP.
//
//   node scripts/smoke-read.mjs [--user 2] [--exchange 8] [--bot 138] [--trades-exchange 15] [--grid 181]
//
// KRIPTTY_API_URL / KRIPTTY_API_TOKEN come from the environment or, if missing, from the "kriptty"
// entry of Claude Desktop's claude_desktop_config.json. The token is never printed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAUSE_MS = 1300;
const PREVIEW_LINES = 8;

function claudeDesktopEnv() {
  const dir = process.platform === 'win32'
    ? path.join(process.env.APPDATA ?? '', 'Claude')
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support', 'Claude')
      : path.join(os.homedir(), '.config', 'Claude');
  try {
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'claude_desktop_config.json'), 'utf8'));
    return config.mcpServers?.kriptty?.env ?? {};
  } catch {
    return {};
  }
}

const fallback = claudeDesktopEnv();
const apiUrl = process.env.KRIPTTY_API_URL || fallback.KRIPTTY_API_URL;
const apiToken = process.env.KRIPTTY_API_TOKEN || fallback.KRIPTTY_API_TOKEN;
if (!apiUrl || !apiToken) {
  console.error('Set KRIPTTY_API_URL and KRIPTTY_API_TOKEN (or configure the kriptty server in Claude Desktop).');
  process.exit(2);
}
const scrub = text => String(text).split(apiToken).join('***');

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean).map(pair => pair.trim().split(/\s+/))
    .map(([key, value]) => [key, value])
);
const num = key => (args[key] ? Number(args[key]) : undefined);

const READ_TOOLS = [
  'list_users', 'get_user', 'list_roles',
  'list_exchange_parameters', 'list_exchanges', 'get_exchange', 'list_exchange_symbols', 'list_positions',
  'list_bot_parameters', 'list_bots', 'get_bot', 'get_bot_status',
  'list_grids', 'get_grid',
  'list_routine_parameters', 'list_routines', 'get_routine',
  'list_trades', 'get_trade', 'list_trade_symbols', 'get_pnl_stats',
];

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, 'dist', 'index.js')],
  env: { ...process.env, KRIPTTY_API_URL: apiUrl, KRIPTTY_API_TOKEN: apiToken, KRIPTTY_READ_ONLY: '1' },
  stderr: 'ignore',
});
const client = new Client({ name: 'kriptty-smoke', version: '1.0.0' });
await client.connect(transport);

let failures = 0;
const { tools } = await client.listTools();
const names = tools.map(t => t.name).sort();
const unexpected = names.filter(n => !READ_TOOLS.includes(n));
const missing = READ_TOOLS.filter(n => !names.includes(n));
const notReadOnly = tools.filter(t => t.annotations?.readOnlyHint !== true).map(t => t.name);
console.log(`Tools exposed in read-only mode: ${names.length}`);
if (unexpected.length || missing.length || notReadOnly.length) {
  failures += 1;
  console.log(`  FAIL unexpected=[${unexpected}] missing=[${missing}] notReadOnly=[${notReadOnly}]`);
} else {
  console.log('  OK: only read tools, all annotated readOnlyHint');
}

async function call(name, toolArgs = {}) {
  const started = Date.now();
  let text;
  try {
    const result = await client.callTool({ name, arguments: toolArgs });
    text = result.content?.map(c => c.text ?? '').join('\n') ?? '';
    if (result.isError) {
      text = `Error (tool): ${text}`;
    }
  } catch (error) {
    text = `Error (MCP): ${error.message}`;
  }
  const failed = /^Error/m.test(text.split('\n')[0]) || /undefined|NaN|\[object Object\]/.test(text);
  if (failed) {
    failures += 1;
  }
  const lines = scrub(text).split('\n');
  console.log(`\n${failed ? 'FAIL' : 'OK  '} ${name} ${JSON.stringify(toolArgs)} (${Date.now() - started} ms)`);
  console.log(lines.slice(0, PREVIEW_LINES).map(l => `  | ${l}`).join('\n') + (lines.length > PREVIEW_LINES ? `\n  | ... (${lines.length} lines)` : ''));
  await new Promise(resolve => setTimeout(resolve, PAUSE_MS));
  return text;
}

const firstMatch = (text, regex) => {
  const match = text.match(regex);
  return match ? match[1] : undefined;
};

await call('list_roles');
const usersText = await call('list_users');
const userId = num('user') ?? Number(firstMatch(usersText, /- ID: (\d+),.*Main exchange ID: \d+/));
await call('get_user', { id: userId });
const exchangesText = await call('list_exchanges', { user_id: userId });
const exchangeId = num('exchange') ?? Number(firstMatch(exchangesText, /- ID: (\d+)/));
await call('get_exchange', { id: exchangeId });
await call('list_exchange_parameters');
await call('list_positions', { exchange_id: exchangeId });
const botsText = await call('list_bots', { exchange_id: exchangeId });
const botId = num('bot') ?? Number(firstMatch(botsText, /- #(\d+) /));
const symbol = firstMatch(botsText, /- #\d+ [^|]*\| ([A-Z0-9]+USDT) \|/) ?? 'BTC';
await call('list_exchange_symbols', { exchange_id: exchangeId, q: symbol.replace(/USDT$/, '') });
await call('get_bot', { id: botId });
await call('get_bot_status', { id: botId });
await call('list_bot_parameters', { user_id: userId });
const gridsText = await call('list_grids', { user_id: userId });
const gridId = num('grid') ?? Number(firstMatch(gridsText, /- ID: (\d+)/));
if (gridId) {
  await call('get_grid', { id: gridId });
}
await call('list_routine_parameters', { user_id: userId });
const routinesText = await call('list_routines', { user_id: userId });
const routineId = firstMatch(routinesText, /- ([0-9a-f-]{36}) \|/);
if (routineId) {
  await call('get_routine', { id: routineId });
}

const tradesExchange = num('trades-exchange') ?? exchangeId;
const symbolsText = await call('list_trade_symbols', { exchange_id: tradesExchange });
const tradesText = await call('list_trades', { exchange_id: tradesExchange, per_page: 3 });
const tradeId = Number(firstMatch(tradesText, /- ID: (\d+) \|/));
const tradedSymbol = firstMatch(symbolsText, /- ([A-Z0-9]+) \(/);
if (tradedSymbol) {
  await call('list_trades', { exchange_id: tradesExchange, symbol: tradedSymbol, per_page: 2 });
}
if (tradeId) {
  await call('get_trade', { id: tradeId });
  const lastDate = firstMatch(tradesText, /\| (\d{4}-\d{2})-\d{2}T/);
  if (lastDate) {
    const [year, month] = lastDate.split('-').map(Number);
    await call('get_pnl_stats', { exchange_id: tradesExchange, period: 'daily', year, month });
  }
}

await client.close();
console.log(`\n${failures === 0 ? 'All read checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
