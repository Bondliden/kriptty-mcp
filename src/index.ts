#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getTransportConfig } from './config.js';
import { startHttpServer } from './transports/http.js';
import {
  listUsers,
  getUser,
  createUser,
  updateUserEmail,
  updateUserName,
  updateUserPassword,
  updateUserAdmin,
  updateUserRole,
  listRoles,
} from './tools/users.js';
import {
  getRoutineParameters,
  listRoutines,
  getRoutine,
  createRoutine,
  updateRoutine,
  runRoutine,
} from './tools/routines.js';
import {
  getExchangeParameters,
  listExchanges,
  getExchange,
  createExchange,
  updateExchange,
  refreshExchange,
} from './tools/exchanges.js';
import {
  getBotParameters,
  listBots,
  getBot,
  createBot,
  updateBot,
  startBot,
  stopBot,
  restartBot,
  swapBotWe,
  simpleSwapBotWe,
  getBotStatus,
} from './tools/bots.js';
import {
  listTrades,
  getTrade,
  listTradeSymbols,
  getPnlStats,
} from './tools/trades.js';

function createServer(): McpServer {
  const server = new McpServer({
    name: 'kriptty-mcp',
    version: '1.0.0',
  });

  server.registerTool(
  'list_users',
  {
    title: 'List Users',
    description: 'List all users from Kriptty',
    inputSchema: {},
  },
  async () => {
    const result = await listUsers();
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'get_user',
  {
    title: 'Get User',
    description: 'Get a single user by ID from Kriptty',
    inputSchema: {
      id: z.number().int().positive().describe('User ID'),
    },
  },
  async (params) => {
    const result = await getUser({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'create_user',
  {
    title: 'Create User',
    description: 'Create a new user in Kriptty',
    inputSchema: {
      name: z.string().min(1).describe('User name'),
      email: z.string().email().describe('User email'),
      password: z.string().min(8).describe('User password (min 8 characters)'),
      role: z.number().int().describe('User role'),
      admin: z.boolean().optional().default(false).describe('Is admin (default: false)'),
    },
  },
  async (params) => {
    const result = await createUser({
      name: params.name,
      email: params.email,
      password: params.password,
      role: params.role,
      admin: params.admin ?? false,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'update_user_email',
  {
    title: 'Update User Email',
    description: 'Update email for a user',
    inputSchema: {
      user_id: z.number().int().positive().describe('User ID'),
      email: z.string().email().describe('New email'),
    },
  },
  async (params) => {
    const result = await updateUserEmail({ user_id: params.user_id, email: params.email });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'update_user_name',
  {
    title: 'Update User Name',
    description: 'Update name for a user',
    inputSchema: {
      user_id: z.number().int().positive().describe('User ID'),
      name: z.string().min(1).describe('New name'),
    },
  },
  async (params) => {
    const result = await updateUserName({ user_id: params.user_id, name: params.name });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'update_user_password',
  {
    title: 'Update User Password',
    description: 'Set a new password for a user',
    inputSchema: {
      user_id: z.number().int().positive().describe('User ID'),
      password: z.string().min(8).describe('New password (min 8 characters)'),
    },
  },
  async (params) => {
    const result = await updateUserPassword({ user_id: params.user_id, password: params.password });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'update_user_admin',
  {
    title: 'Update User Admin Status',
    description: 'Set admin status for a user',
    inputSchema: {
      user_id: z.number().int().positive().describe('User ID'),
      admin: z.boolean().describe('Admin status (true/false)'),
    },
  },
  async (params) => {
    const result = await updateUserAdmin({ user_id: params.user_id, admin: params.admin });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'update_user_role',
  {
    title: 'Update User Role',
    description: 'Update role for a user',
    inputSchema: {
      user_id: z.number().int().positive().describe('User ID'),
      role: z.number().int().describe('New role'),
    },
  },
  async (params) => {
    const result = await updateUserRole({ user_id: params.user_id, role: params.role });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'list_roles',
  {
    title: 'List Roles',
    description: 'List available user roles',
    inputSchema: {},
  },
  async () => {
    const result = listRoles();
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

// Routine tools
server.registerTool(
  'list_routine_parameters',
  {
    title: 'List Routine Parameters',
    description: 'List available routine parameters (grid modes, bot modes, and custom grids)',
    inputSchema: {},
  },
  async () => {
    const result = await getRoutineParameters();
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'list_routines',
  {
    title: 'List Routines',
    description: 'List all routines from Kriptty',
    inputSchema: {},
  },
  async () => {
    const result = await listRoutines();
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'get_routine',
  {
    title: 'Get Routine',
    description: 'Get a single routine by ID from Kriptty',
    inputSchema: {
      id: z.string().uuid().describe('Routine ID (UUID)'),
    },
  },
  async (params) => {
    const result = await getRoutine({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'create_routine',
  {
    title: 'Create Routine',
    description: 'Create a new routine in Kriptty',
    inputSchema: {
      user_id: z.number().int().positive().describe('User ID'),
      name: z.string().min(1).max(52).describe('Routine name'),
      grid_mode: z.enum(['recursive', 'neat', 'static', 'clock', 'custom']).describe('Grid mode'),
      grid_id: z.number().int().min(0).describe('Grid ID (0 for none)'),
      lm: z.enum(['n', 'm', 'gs', 't', 'p']).describe('Long mode: n=normal, m=manual, gs=graceful stop, t=take profit, p=panic'),
      lwe: z.number().min(0).max(11).describe('Long wallet exposure (0-11)'),
      sm: z.enum(['n', 'm', 'gs', 't', 'p']).describe('Short mode: n=normal, m=manual, gs=graceful stop, t=take profit, p=panic'),
      swe: z.number().min(0).max(11).describe('Short wallet exposure (0-11)'),
    },
  },
  async (params) => {
    const result = await createRoutine({
      user_id: params.user_id,
      name: params.name,
      grid_mode: params.grid_mode,
      grid_id: params.grid_id,
      lm: params.lm,
      lwe: params.lwe,
      sm: params.sm,
      swe: params.swe,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'update_routine',
  {
    title: 'Update Routine',
    description: 'Update an existing routine in Kriptty',
    inputSchema: {
      id: z.string().uuid().describe('Routine ID (UUID)'),
      name: z.string().min(1).max(52).optional().describe('Routine name'),
      grid_mode: z.enum(['recursive', 'neat', 'static', 'clock', 'custom']).optional().describe('Grid mode'),
      grid_id: z.number().int().min(0).optional().describe('Grid ID (0 for none)'),
      lm: z.enum(['n', 'm', 'gs', 't', 'p']).optional().describe('Long mode'),
      lwe: z.number().min(0).max(11).optional().describe('Long wallet exposure (0-11)'),
      sm: z.enum(['n', 'm', 'gs', 't', 'p']).optional().describe('Short mode'),
      swe: z.number().min(0).max(11).optional().describe('Short wallet exposure (0-11)'),
    },
  },
  async (params) => {
    const result = await updateRoutine({
      id: params.id,
      name: params.name,
      grid_mode: params.grid_mode,
      grid_id: params.grid_id,
      lm: params.lm,
      lwe: params.lwe,
      sm: params.sm,
      swe: params.swe,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'run_routine',
  {
    title: 'Run Routine',
    description: 'Execute a routine to apply its configuration to all bots on the specified exchange. Use list_users to find exchange IDs.',
    inputSchema: {
      id: z.string().uuid().describe('Routine ID (UUID)'),
      exchange_id: z.number().int().positive().describe('Exchange ID to run routine on (get from list_users)'),
    },
  },
  async (params) => {
    const result = await runRoutine({ id: params.id, exchange_id: params.exchange_id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

// Exchange tools
server.registerTool(
  'list_exchange_parameters',
  {
    title: 'List Exchange Parameters',
    description: 'List available exchange types, risk modes, and field requirements',
    inputSchema: {},
  },
  async () => {
    const result = await getExchangeParameters();
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'list_exchanges',
  {
    title: 'List User Exchanges',
    description: 'List all exchanges for a specific user',
    inputSchema: {
      user_id: z.number().int().positive().describe('User ID to list exchanges for'),
    },
  },
  async (params) => {
    const result = await listExchanges({ user_id: params.user_id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'get_exchange',
  {
    title: 'Get Exchange',
    description: 'Get detailed information about a specific exchange',
    inputSchema: {
      id: z.number().int().positive().describe('Exchange ID'),
    },
  },
  async (params) => {
    const result = await getExchange({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'create_exchange',
  {
    title: 'Create Exchange',
    description: 'Create a new exchange for a user with API credentials. Use list_exchange_parameters to see available options.',
    inputSchema: {
      user_id: z.number().int().positive().describe('User ID'),
      name: z.string().min(1).max(255).describe('Exchange name'),
      exchange: z.enum(['bybit', 'binance', 'binance_us', 'bitget', 'okx']).describe('Exchange type'),
      risk_mode: z.enum(['1', '2', '3']).describe('Risk mode: 1=Conservative, 2=Moderate, 3=Kamikaze'),
      api_key: z.string().min(1).max(100).describe('API key'),
      api_secret: z.string().min(1).max(100).describe('API secret'),
      api_frase: z.string().max(250).optional().describe('API passphrase (required for OKX)'),
      is_testnet: z.boolean().optional().default(false).describe('Use testnet (Bybit only)'),
    },
  },
  async (params) => {
    const result = await createExchange({
      user_id: params.user_id,
      name: params.name,
      exchange: params.exchange,
      risk_mode: params.risk_mode,
      api_key: params.api_key,
      api_secret: params.api_secret,
      api_frase: params.api_frase,
      is_testnet: params.is_testnet ?? false,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'update_exchange',
  {
    title: 'Update Exchange',
    description: 'Update an existing exchange. Only provided fields will be updated.',
    inputSchema: {
      id: z.number().int().positive().describe('Exchange ID'),
      name: z.string().min(1).max(255).optional().describe('Exchange name'),
      exchange: z.enum(['bybit', 'binance', 'binance_us', 'bitget', 'okx']).optional().describe('Exchange type'),
      risk_mode: z.enum(['1', '2', '3']).optional().describe('Risk mode'),
      api_key: z.string().min(1).max(100).optional().describe('API key'),
      api_secret: z.string().min(1).max(100).optional().describe('API secret'),
      api_frase: z.string().max(250).optional().describe('API passphrase'),
      is_testnet: z.boolean().optional().describe('Use testnet'),
    },
  },
  async (params) => {
    const result = await updateExchange({
      id: params.id,
      name: params.name,
      exchange: params.exchange,
      risk_mode: params.risk_mode,
      api_key: params.api_key,
      api_secret: params.api_secret,
      api_frase: params.api_frase,
      is_testnet: params.is_testnet,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'refresh_exchange',
  {
    title: 'Refresh Exchange Connectivity',
    description: 'Test exchange API connectivity by syncing balance. Updates api_error flag on failure.',
    inputSchema: {
      id: z.number().int().positive().describe('Exchange ID'),
    },
  },
  async (params) => {
    const result = await refreshExchange({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

// Bot tools
server.registerTool(
  'list_bot_parameters',
  {
    title: 'List Bot Parameters',
    description: 'List available bot parameters (bot modes, grid modes, market types, grids, and symbols)',
    inputSchema: {},
  },
  async () => {
    const result = await getBotParameters();
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'list_bots',
  {
    title: 'List Bots',
    description: 'List bots filtered by user_id or exchange_id. At least one filter is required.',
    inputSchema: {
      user_id: z.number().int().positive().optional().describe('User ID to list bots for'),
      exchange_id: z.number().int().positive().optional().describe('Exchange ID to list bots for'),
    },
  },
  async (params) => {
    const result = await listBots({ user_id: params.user_id, exchange_id: params.exchange_id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'get_bot',
  {
    title: 'Get Bot',
    description: 'Get detailed information about a specific bot',
    inputSchema: {
      id: z.number().int().positive().describe('Bot ID'),
    },
  },
  async (params) => {
    const result = await getBot({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'create_bot',
  {
    title: 'Create Bot',
    description: 'Create a new bot. Use list_bot_parameters to see available options for symbol_id, grid_mode, etc.',
    inputSchema: {
      name: z.string().min(1).max(255).describe('Bot name'),
      exchange_id: z.number().int().positive().describe('Exchange ID'),
      symbol_id: z.number().int().positive().describe('Symbol ID (use list_bot_parameters to see available symbols)'),
      market_type: z.enum(['futures', 'spot']).describe('Market type'),
      grid_mode: z.enum(['recursive', 'neat', 'static', 'clock', 'custom']).describe('Grid mode'),
      grid_id: z.number().int().positive().optional().describe('Grid ID (required when grid_mode is "custom")'),
      lm: z.enum(['n', 'm', 'gs', 't', 'p']).describe('Long mode: n=normal, m=manual, gs=graceful stop, t=take profit, p=panic'),
      lwe: z.number().min(0).max(11).describe('Long wallet exposure (0-11)'),
      sm: z.enum(['n', 'm', 'gs', 't', 'p']).describe('Short mode: n=normal, m=manual, gs=graceful stop, t=take profit, p=panic'),
      swe: z.number().min(0).max(11).describe('Short wallet exposure (0-11)'),
      leverage: z.number().min(1).max(125).optional().describe('Leverage (default: 10)'),
      assigned_balance: z.number().min(0).optional().describe('Assigned balance (default: 0 for no limit)'),
      oh_mode: z.boolean().optional().describe('Order history mode (default: true)'),
      show_logs: z.boolean().optional().describe('Show logs (default: true)'),
      is_on_trend: z.boolean().optional().describe('Is on trend (default: false)'),
      is_on_routines: z.boolean().optional().describe('Is on routines (default: false)'),
    },
  },
  async (params) => {
    const result = await createBot({
      name: params.name,
      exchange_id: params.exchange_id,
      symbol_id: params.symbol_id,
      market_type: params.market_type,
      grid_mode: params.grid_mode,
      grid_id: params.grid_id,
      lm: params.lm,
      lwe: params.lwe,
      sm: params.sm,
      swe: params.swe,
      leverage: params.leverage,
      assigned_balance: params.assigned_balance,
      oh_mode: params.oh_mode,
      show_logs: params.show_logs,
      is_on_trend: params.is_on_trend,
      is_on_routines: params.is_on_routines,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'update_bot',
  {
    title: 'Update Bot',
    description: 'Update an existing bot. Only provided fields will be updated.',
    inputSchema: {
      id: z.number().int().positive().describe('Bot ID'),
      name: z.string().min(1).max(255).optional().describe('Bot name'),
      symbol_id: z.number().int().positive().optional().describe('Symbol ID'),
      market_type: z.enum(['futures', 'spot']).optional().describe('Market type'),
      grid_mode: z.enum(['recursive', 'neat', 'static', 'clock', 'custom']).optional().describe('Grid mode'),
      grid_id: z.number().int().positive().nullable().optional().describe('Grid ID'),
      lm: z.enum(['n', 'm', 'gs', 't', 'p']).optional().describe('Long mode'),
      lwe: z.number().min(0).max(11).optional().describe('Long wallet exposure (0-11)'),
      sm: z.enum(['n', 'm', 'gs', 't', 'p']).optional().describe('Short mode'),
      swe: z.number().min(0).max(11).optional().describe('Short wallet exposure (0-11)'),
      leverage: z.number().min(1).max(125).optional().describe('Leverage'),
      assigned_balance: z.number().min(0).optional().describe('Assigned balance'),
      oh_mode: z.boolean().optional().describe('Order history mode'),
      show_logs: z.boolean().optional().describe('Show logs'),
      is_on_trend: z.boolean().optional().describe('Is on trend'),
      is_on_routines: z.boolean().optional().describe('Is on routines'),
    },
  },
  async (params) => {
    const result = await updateBot({
      id: params.id,
      name: params.name,
      symbol_id: params.symbol_id,
      market_type: params.market_type,
      grid_mode: params.grid_mode,
      grid_id: params.grid_id,
      lm: params.lm,
      lwe: params.lwe,
      sm: params.sm,
      swe: params.swe,
      leverage: params.leverage,
      assigned_balance: params.assigned_balance,
      oh_mode: params.oh_mode,
      show_logs: params.show_logs,
      is_on_trend: params.is_on_trend,
      is_on_routines: params.is_on_routines,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'start_bot',
  {
    title: 'Start Bot',
    description: 'Start a stopped bot',
    inputSchema: {
      id: z.number().int().positive().describe('Bot ID'),
    },
  },
  async (params) => {
    const result = await startBot({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'stop_bot',
  {
    title: 'Stop Bot',
    description: 'Stop a running bot',
    inputSchema: {
      id: z.number().int().positive().describe('Bot ID'),
    },
  },
  async (params) => {
    const result = await stopBot({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'restart_bot',
  {
    title: 'Restart Bot',
    description: 'Restart a bot (stop and start)',
    inputSchema: {
      id: z.number().int().positive().describe('Bot ID'),
    },
  },
  async (params) => {
    const result = await restartBot({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'swap_bot_we',
  {
    title: 'Swap Bot Wallet Exposure',
    description: 'Swap wallet exposure based on trend direction. Sets long WE to 0.06 and short WE to 0.03 for LONG trend, and vice versa for SHORT.',
    inputSchema: {
      id: z.number().int().positive().describe('Bot ID'),
      new_trend: z.enum(['LONG', 'SHORT']).describe('New trend direction'),
    },
  },
  async (params) => {
    const result = await swapBotWe({ id: params.id, new_trend: params.new_trend });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'simple_swap_bot_we',
  {
    title: 'Simple Swap Bot Wallet Exposure',
    description: 'Simply swap the long and short wallet exposure values with each other',
    inputSchema: {
      id: z.number().int().positive().describe('Bot ID'),
    },
  },
  async (params) => {
    const result = await simpleSwapBotWe({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'get_bot_status',
  {
    title: 'Get Bot Status',
    description: 'Check if a bot process is currently running',
    inputSchema: {
      id: z.number().int().positive().describe('Bot ID'),
    },
  },
  async (params) => {
    const result = await getBotStatus({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

// Trade tools
server.registerTool(
  'list_trades',
  {
    title: 'List Trades',
    description: 'List trades for an exchange with optional filtering by symbol, date range, and sorting',
    inputSchema: {
      exchange_id: z.number().int().positive().describe('Exchange ID (required)'),
      symbol: z.string().optional().describe('Filter by trading symbol (e.g., BTCUSDT)'),
      from_date: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
      to_date: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
      per_page: z.number().int().min(1).max(100).optional().describe('Records per page (default: 25, max: 100)'),
      sort_by: z.enum(['id', 'symbol', 'side', 'qty', 'closed_pnl', 'order_price', 'leverage', 'created_at']).optional().describe('Column to sort by'),
      sort_order: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: desc)'),
    },
  },
  async (params) => {
    const result = await listTrades({
      exchange_id: params.exchange_id,
      symbol: params.symbol,
      from_date: params.from_date,
      to_date: params.to_date,
      per_page: params.per_page,
      sort_by: params.sort_by,
      sort_order: params.sort_order,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'get_trade',
  {
    title: 'Get Trade',
    description: 'Get detailed information about a specific trade',
    inputSchema: {
      id: z.number().int().positive().describe('Trade ID'),
    },
  },
  async (params) => {
    const result = await getTrade({ id: params.id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'list_trade_symbols',
  {
    title: 'List Trade Symbols',
    description: 'Get list of unique symbols that have been traded on an exchange',
    inputSchema: {
      exchange_id: z.number().int().positive().describe('Exchange ID'),
    },
  },
  async (params) => {
    const result = await listTradeSymbols({ exchange_id: params.exchange_id });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

server.registerTool(
  'get_pnl_stats',
  {
    title: 'Get P&L Statistics',
    description: 'Get profit and loss statistics aggregated by period (daily, monthly, yearly) for an exchange',
    inputSchema: {
      exchange_id: z.number().int().positive().describe('Exchange ID (required)'),
      period: z.enum(['daily', 'monthly', 'yearly']).optional().describe('Aggregation period (default: daily)'),
      month: z.number().int().min(1).max(12).optional().describe('Month filter for daily period (1-12)'),
      year: z.number().int().min(2020).max(2100).optional().describe('Year filter'),
    },
  },
  async (params) => {
    const result = await getPnlStats({
      exchange_id: params.exchange_id,
      period: params.period,
      month: params.month,
      year: params.year,
    });
    return {
      content: [{ type: 'text', text: result }],
    };
  }
);

  return server;
}

async function main() {
  const transportConfig = getTransportConfig();

  if (transportConfig.transportMode === 'http') {
    await startHttpServer(createServer);
  } else {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Kriptty MCP server running on stdio');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
