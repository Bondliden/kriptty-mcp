#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getTransportConfig, isReadOnly } from './config.js';
import { startHttpServer } from './transports/http.js';
import { VERSION } from './version.js';
import * as users from './tools/users.js';
import * as exchanges from './tools/exchanges.js';
import * as bots from './tools/bots.js';
import * as grids from './tools/grids.js';
import * as routines from './tools/routines.js';
import * as trades from './tools/trades.js';

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  schema: z.ZodObject;
  /** GET-only tools. KRIPTTY_READ_ONLY=1 registers nothing else. */
  readOnly: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  run: (params: any) => Promise<string> | string;
}

function tool<S extends z.ZodObject>(
  definition: Omit<ToolDefinition, 'schema' | 'run'> & { schema: S; run: (params: z.infer<S>) => Promise<string> | string }
): ToolDefinition {
  return definition;
}

const TOOLS: ToolDefinition[] = [
  // Users
  tool({
    name: 'list_users', title: 'List Users', readOnly: true,
    description: 'List all users from Kriptty with their main exchange ID',
    schema: users.listUsersSchema, run: users.listUsers,
  }),
  tool({
    name: 'get_user', title: 'Get User', readOnly: true,
    description: 'Get a single user by ID from Kriptty',
    schema: users.getUserSchema, run: users.getUser,
  }),
  tool({
    name: 'create_user', title: 'Create User', readOnly: false, destructive: false,
    description: 'Create a new user in Kriptty',
    schema: users.createUserSchema, run: users.createUser,
  }),
  tool({
    name: 'update_user_email', title: 'Update User Email', readOnly: false, destructive: true, idempotent: true,
    description: 'Update email for a user',
    schema: users.updateUserEmailSchema, run: users.updateUserEmail,
  }),
  tool({
    name: 'update_user_name', title: 'Update User Name', readOnly: false, destructive: true, idempotent: true,
    description: 'Update name for a user',
    schema: users.updateUserNameSchema, run: users.updateUserName,
  }),
  tool({
    name: 'update_user_password', title: 'Update User Password', readOnly: false, destructive: true, idempotent: true,
    description: 'Set a new password for a user',
    schema: users.updateUserPasswordSchema, run: users.updateUserPassword,
  }),
  tool({
    name: 'update_user_admin', title: 'Update User Admin Status', readOnly: false, destructive: true, idempotent: true,
    description: 'Set admin status for a user',
    schema: users.updateUserAdminSchema, run: users.updateUserAdmin,
  }),
  tool({
    name: 'update_user_role', title: 'Update User Role', readOnly: false, destructive: true, idempotent: true,
    description: 'Update role for a user (1=Admin, 2=User)',
    schema: users.updateUserRoleSchema, run: users.updateUserRole,
  }),
  tool({
    name: 'list_roles', title: 'List Roles', readOnly: true,
    description: 'List available user roles',
    schema: users.listRolesSchema, run: users.listRoles,
  }),

  // Exchanges
  tool({
    name: 'list_exchange_parameters', title: 'List Exchange Parameters', readOnly: true,
    description: 'List available exchange types, risk modes, and field requirements (no API call)',
    schema: exchanges.getExchangeParametersSchema, run: exchanges.getExchangeParameters,
  }),
  tool({
    name: 'list_exchanges', title: 'List User Exchanges', readOnly: true,
    description: 'List all exchanges (accounts) of a specific user, with balance and API error flag',
    schema: exchanges.listExchangesSchema, run: exchanges.listExchanges,
  }),
  tool({
    name: 'get_exchange', title: 'Get Exchange', readOnly: true,
    description: 'Get detailed information about a specific exchange (API keys are never returned)',
    schema: exchanges.getExchangeSchema, run: exchanges.getExchange,
  }),
  tool({
    name: 'create_exchange', title: 'Create Exchange', readOnly: false, destructive: false,
    description: 'Create a new exchange for a user with API credentials. Known API issue: AdminApiController::createExchange drops user_id (not fillable), so this fails until the API is fixed.',
    schema: exchanges.createExchangeSchema, run: exchanges.createExchange,
  }),
  tool({
    name: 'update_exchange', title: 'Update Exchange', readOnly: false, destructive: true, idempotent: true,
    description: 'Update an existing exchange (name, type, risk mode, credentials). Only provided fields are updated.',
    schema: exchanges.updateExchangeSchema, run: exchanges.updateExchange,
  }),
  tool({
    name: 'refresh_exchange', title: 'Refresh Exchange', readOnly: false, destructive: false, idempotent: true,
    description: 'Ask the API to refresh an exchange. The current admin API only returns the stored exchange; it does not re-sync the balance.',
    schema: exchanges.refreshExchangeSchema, run: exchanges.refreshExchange,
  }),
  tool({
    name: 'list_exchange_symbols', title: 'List Exchange Symbols', readOnly: true,
    description: 'List the symbols available on the exchange of an account (id, exchange name, short name), optionally filtered',
    schema: exchanges.listExchangeSymbolsSchema, run: exchanges.listExchangeSymbols,
  }),
  tool({
    name: 'list_positions', title: 'List Open Positions', readOnly: true,
    description: 'List open positions of an exchange (synced every 5 minutes) with unrealised PnL',
    schema: exchanges.listPositionsSchema, run: exchanges.listPositions,
  }),

  // Bots
  tool({
    name: 'list_bot_parameters', title: 'List Bot Parameters', readOnly: true,
    description: 'List bot modes, grid modes, market types, API limits and the available grids',
    schema: bots.getBotParametersSchema, run: bots.getBotParameters,
  }),
  tool({
    name: 'list_bots', title: 'List Bots', readOnly: true,
    description: 'List bots filtered by user_id or exchange_id (one line per bot). At least one filter is required.',
    schema: bots.listBotsSchema, run: bots.listBots,
  }),
  tool({
    name: 'get_bot', title: 'Get Bot', readOnly: true,
    description: 'Get detailed information about a specific bot, including a live process check',
    schema: bots.getBotSchema, run: bots.getBot,
  }),
  tool({
    name: 'create_bot', title: 'Create Bot', readOnly: false, destructive: false,
    description: 'Create a new bot (stopped) for the owner of the exchange. Refuses a symbol that already has a bot in that account. Use list_bot_parameters, list_exchange_symbols and list_grids for the options.',
    schema: bots.createBotSchema, run: bots.createBot,
  }),
  tool({
    name: 'update_bot', title: 'Update Bot', readOnly: false, destructive: true, idempotent: true,
    description: 'Update a bot (validated by the API: wallet exposure 0-2, leverage 1-20). Only provided fields are updated; restart=true restarts it if running so Passivbot loads the change.',
    schema: bots.updateBotSchema, run: bots.updateBot,
  }),
  tool({
    name: 'start_bot', title: 'Start Bot', readOnly: false, destructive: false, idempotent: true,
    description: 'Start a stopped bot',
    schema: bots.startBotSchema, run: bots.startBot,
  }),
  tool({
    name: 'stop_bot', title: 'Stop Bot', readOnly: false, destructive: true, idempotent: true,
    description: 'Stop a running bot',
    schema: bots.stopBotSchema, run: bots.stopBot,
  }),
  tool({
    name: 'restart_bot', title: 'Restart Bot', readOnly: false, destructive: true,
    description: 'Restart a bot (stop and start)',
    schema: bots.restartBotSchema, run: bots.restartBot,
  }),
  tool({
    name: 'get_bot_status', title: 'Get Bot Status', readOnly: true,
    description: 'Check if a bot process is currently running (live check on the server) and its current settings',
    schema: bots.getBotStatusSchema, run: bots.getBotStatus,
  }),

  // Grids
  tool({
    name: 'list_grids', title: 'List Grids', readOnly: true,
    description: 'List saved grid configurations (Passivbot), optionally for one user, with how many bots use each',
    schema: grids.listGridsSchema, run: grids.listGrids,
  }),
  tool({
    name: 'get_grid', title: 'Get Grid', readOnly: true,
    description: 'Get a grid configuration with its Passivbot JSON',
    schema: grids.getGridSchema, run: grids.getGrid,
  }),

  // Routines
  tool({
    name: 'list_routine_parameters', title: 'List Routine Parameters', readOnly: true,
    description: 'List grid modes, bot modes and the available grids for routines',
    schema: routines.getRoutineParametersSchema, run: routines.getRoutineParameters,
  }),
  tool({
    name: 'list_routines', title: 'List Routines', readOnly: true,
    description: 'List routines, optionally for one user',
    schema: routines.listRoutinesSchema, run: routines.listRoutines,
  }),
  tool({
    name: 'get_routine', title: 'Get Routine', readOnly: true,
    description: 'Get a single routine by ID from Kriptty',
    schema: routines.getRoutineSchema, run: routines.getRoutine,
  }),
  tool({
    name: 'create_routine', title: 'Create Routine', readOnly: false, destructive: false,
    description: 'Create a new routine in Kriptty',
    schema: routines.createRoutineSchema, run: routines.createRoutine,
  }),
  tool({
    name: 'update_routine', title: 'Update Routine', readOnly: false, destructive: true, idempotent: true,
    description: 'Update an existing routine; action fields are merged with the stored ones',
    schema: routines.updateRoutineSchema, run: routines.updateRoutine,
  }),
  tool({
    name: 'run_routine', title: 'Run Routine', readOnly: false, destructive: false, idempotent: true,
    description: 'Call the run endpoint of a routine. The current admin API does NOT execute the routine: it only returns it, so no bot changes.',
    schema: routines.runRoutineSchema, run: routines.runRoutine,
  }),

  // Trades
  tool({
    name: 'list_trades', title: 'List Trades', readOnly: true,
    description: 'List trades of an exchange, newest first, with optional symbol and date filters and pagination',
    schema: trades.listTradesSchema, run: trades.listTrades,
  }),
  tool({
    name: 'get_trade', title: 'Get Trade', readOnly: true,
    description: 'Get detailed information about a specific trade',
    schema: trades.getTradeSchema, run: trades.getTrade,
  }),
  tool({
    name: 'list_trade_symbols', title: 'List Trade Symbols', readOnly: true,
    description: 'Get the list of unique symbols that have been traded on an exchange',
    schema: trades.listTradeSymbolsSchema, run: trades.listTradeSymbols,
  }),
  tool({
    name: 'get_pnl_stats', title: 'Get P&L Statistics', readOnly: true,
    description: 'Profit and loss of an exchange aggregated by day, month or year and by symbol. Without year, period=yearly downloads every trade of the account in one request.',
    schema: trades.getPnlStatsSchema, run: trades.getPnlStats,
  }),
];

function createServer(): McpServer {
  const server = new McpServer({
    name: 'kriptty-mcp',
    version: VERSION,
  });
  const readOnly = isReadOnly();

  for (const definition of TOOLS) {
    if (readOnly && !definition.readOnly) {
      continue;
    }
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.schema,
        annotations: {
          readOnlyHint: definition.readOnly,
          destructiveHint: definition.readOnly ? false : definition.destructive ?? true,
          idempotentHint: definition.readOnly || (definition.idempotent ?? false),
        },
      },
      async (params: unknown) => ({
        content: [{ type: 'text' as const, text: await definition.run(params) }],
      })
    );
  }

  return server;
}

async function main() {
  const transportConfig = getTransportConfig();
  const mode = isReadOnly() ? ' (read-only: write tools disabled)' : '';

  if (transportConfig.transportMode === 'http') {
    await startHttpServer(createServer);
  } else {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Kriptty MCP server ${VERSION} running on stdio${mode}`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
