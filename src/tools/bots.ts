import { z } from 'zod';
import { getApiClient, type Bot, type BotStatus, type BotUpdateData } from '../api/client.js';
import {
  apiErrorText,
  BOT_LIMITS,
  BOT_MODES,
  botModeLabels,
  GRID_MODES,
  gridModeLabels,
  isRunningFlag,
  MARKET_TYPES,
  symbolNames,
  yesNo,
} from './common.js';

const botId = z.number().int().positive().describe('Bot ID');
const botName = z.string().min(1).max(BOT_LIMITS.nameMax).describe(`Bot name (max ${BOT_LIMITS.nameMax} characters)`);
const botMode = z.enum(BOT_MODES);
const walletExposure = z.number().min(0).max(BOT_LIMITS.weMax);
const leverage = z.number().int().min(1).max(BOT_LIMITS.leverageMax);
const symbolName = z.string().min(1).max(40);

export const getBotParametersSchema = z.object({
  user_id: z.number().int().positive().optional().describe('Only list the grids of this user'),
});

export const listBotsSchema = z.object({
  user_id: z.number().int().positive().optional().describe('User ID to list bots for'),
  exchange_id: z.number().int().positive().optional().describe('Exchange ID to list bots for'),
});

export const getBotSchema = z.object({ id: botId });

export const createBotSchema = z.object({
  name: botName,
  exchange_id: z.number().int().positive().describe('Exchange ID; the bot is created for the owner of this exchange'),
  symbol_id: z.number().int().positive().optional().describe('Symbol ID (see list_exchange_symbols)'),
  symbol: symbolName.optional().describe('Short symbol name instead of symbol_id, e.g. "ALGOUSDT"'),
  market_type: z.enum(MARKET_TYPES).default('futures').describe('Market type (default: futures)'),
  grid_mode: z.enum(GRID_MODES).describe('Grid mode'),
  grid_id: z.number().int().positive().optional().describe('Grid ID, required when grid_mode is "custom" (see list_grids)'),
  lm: botMode.describe('Long mode: n=normal, m=manual, gs=graceful stop, t=take profit only, p=panic'),
  lwe: walletExposure.describe(`Long wallet exposure (0-${BOT_LIMITS.weMax})`),
  sm: botMode.describe('Short mode: n=normal, m=manual, gs=graceful stop, t=take profit only, p=panic'),
  swe: walletExposure.describe(`Short wallet exposure (0-${BOT_LIMITS.weMax})`),
  leverage: leverage.default(7).describe(`Leverage (1-${BOT_LIMITS.leverageMax}, default: 7)`),
  assigned_balance: z.number().min(0).default(0).describe('Assigned balance (default: 0 = no limit)'),
  oh_mode: z.boolean().default(false).describe('Order history mode (default: false)'),
  show_logs: z.boolean().default(false).describe('Show logs (default: false)'),
  is_on_trend: z.boolean().default(false).describe('Is on trend (default: false)'),
  is_on_routines: z.boolean().default(true).describe('Is on routines (default: true)'),
});

export const updateBotSchema = z.object({
  id: botId,
  name: botName.optional(),
  symbol_id: z.number().int().positive().optional().describe('Symbol ID (see list_exchange_symbols)'),
  symbol: symbolName.optional().describe('Short symbol name instead of symbol_id, e.g. "ALGOUSDT"'),
  grid_mode: z.enum(GRID_MODES).optional().describe('Grid mode'),
  grid_id: z.number().int().positive().optional().describe('Grid ID (see list_grids)'),
  lm: botMode.optional().describe('Long mode: n=normal, m=manual, gs=graceful stop, t=take profit only, p=panic'),
  lwe: walletExposure.optional().describe(`Long wallet exposure (0-${BOT_LIMITS.weMax})`),
  sm: botMode.optional().describe('Short mode: n=normal, m=manual, gs=graceful stop, t=take profit only, p=panic'),
  swe: walletExposure.optional().describe(`Short wallet exposure (0-${BOT_LIMITS.weMax})`),
  leverage: leverage.optional().describe(`Leverage (1-${BOT_LIMITS.leverageMax})`),
  assigned_balance: z.number().min(0).optional().describe('Assigned balance (0 = no limit)'),
  show_logs: z.boolean().optional().describe('Show logs'),
  is_on_trend: z.boolean().optional().describe('Is on trend'),
  is_on_routines: z.boolean().optional().describe('Is on routines'),
  restart: z.boolean().default(false).describe('Restart the bot afterwards if it is running, so Passivbot loads the change (default: false)'),
});

export const startBotSchema = z.object({ id: botId });
export const stopBotSchema = z.object({ id: botId });
export const restartBotSchema = z.object({ id: botId });
export const getBotStatusSchema = z.object({ id: botId });

export type GetBotParametersParams = z.infer<typeof getBotParametersSchema>;
export type ListBotsParams = z.infer<typeof listBotsSchema>;
export type GetBotParams = z.infer<typeof getBotSchema>;
export type CreateBotParams = z.infer<typeof createBotSchema>;
export type UpdateBotParams = z.infer<typeof updateBotSchema>;
export type BotIdParams = z.infer<typeof startBotSchema>;

// Above this many accounts in one listing, symbol ids are shown without resolving their names.
const MAX_SYMBOL_LOOKUPS = 3;

function modeText(mode: string): string {
  return botModeLabels[mode] ? `${botModeLabels[mode]} (${mode})` : mode;
}

function gridText(bot: Bot): string {
  const mode = gridModeLabels[bot.grid_mode] || bot.grid_mode;
  return bot.grid_id ? `${mode}, grid #${bot.grid_id}` : mode;
}

function stateText(bot: Bot): string {
  return isRunningFlag(bot) ? `ON (pid ${bot.pid})` : 'OFF';
}

function formatBotLine(bot: Bot, names: Map<number, string>): string {
  const symbol = names.get(bot.symbol_id) ?? `symbol #${bot.symbol_id}`;
  return `- #${bot.id} ${bot.name} | ${symbol} | ${stateText(bot)} | exchange ${bot.exchange_id} | ${gridText(bot)} | long ${bot.lm} ${bot.lwe} | short ${bot.sm} ${bot.swe} | x${bot.leverage}`;
}

function formatBotDetailed(bot: Bot, status: BotStatus | null, statusError: string | null): string {
  const symbol = status?.symbol ? `${status.symbol} (ID: ${bot.symbol_id})` : `ID: ${bot.symbol_id}`;
  const live = status ? (status.running ? 'Yes' : 'No') : `Unknown (${statusError})`;
  const trends = [['5m', bot.trend_5m], ['15m', bot.trend_15m], ['30m', bot.trend_30m], ['1h', bot.trend_1h]]
    .filter(([, value]) => value)
    .map(([frame, value]) => `${frame}: ${value}`)
    .join(', ');
  return `Bot Details:
- ID: ${bot.id}
- Name: ${bot.name}
- Process running (live check): ${live}
- Database flag: ${stateText(bot)}
- Started At: ${bot.started_at || 'N/A'}
- Stopped At: ${bot.stopped_at || 'N/A'}

Configuration:
- Exchange ID: ${bot.exchange_id}
- Symbol: ${symbol}
- Market Type: ${bot.market_type}
- Grid: ${gridText(bot)}
- Leverage: ${bot.leverage}x
- Assigned Balance: ${Number(bot.assigned_balance) > 0 ? bot.assigned_balance : 'No limit'}

Trading Modes:
- Long: ${modeText(bot.lm)}, wallet exposure ${bot.lwe}
- Short: ${modeText(bot.sm)}, wallet exposure ${bot.swe}

Options:
- Order History Mode: ${bot.oh_mode ? 'Enabled' : 'Disabled'}
- Show Logs: ${yesNo(bot.show_logs)}
- On Trend: ${yesNo(bot.is_on_trend)}
- On Routines: ${yesNo(bot.is_on_routines)}${trends ? `\n- Trends: ${trends}` : ''}

Metadata:
- User ID: ${bot.user_id}
- Created: ${bot.created_at}
- Updated: ${bot.updated_at}`;
}

function formatBotSummary(bot: Bot): string {
  return `- ID: ${bot.id}
- Name: ${bot.name}
- Database flag: ${stateText(bot)}
- Grid: ${gridText(bot)}
- Long: ${modeText(bot.lm)}, wallet exposure ${bot.lwe}
- Short: ${modeText(bot.sm)}, wallet exposure ${bot.swe}
- Leverage: ${bot.leverage}x`;
}

/** Resolves a short symbol name ("ALGOUSDT") or validates a symbol id on the exchange type of an account. */
async function resolveSymbol(exchangeId: number, symbolId?: number, symbol?: string): Promise<{ id: number; name: string } | string> {
  const names = await symbolNames(exchangeId);
  if (symbolId !== undefined) {
    const name = names.get(symbolId);
    return name ? { id: symbolId, name } : `Symbol ID ${symbolId} does not exist on the exchange of account ${exchangeId}.`;
  }
  const wanted = (symbol ?? '').toUpperCase();
  for (const [id, name] of names) {
    if (name.toUpperCase() === wanted) {
      return { id, name };
    }
  }
  return `Symbol "${symbol}" not found on the exchange of account ${exchangeId} (see list_exchange_symbols).`;
}

/** Two bots on the same symbol in one account would fight over the same position. */
async function symbolTakenBy(exchangeId: number, symbolId: number, exceptBotId?: number): Promise<Bot | undefined> {
  const bots = await getApiClient().listBots({ exchange_id: exchangeId });
  return bots.find(b => b.symbol_id === symbolId && b.id !== exceptBotId);
}

/** The admin API has no parameters endpoint: enums come from antbot, grids from GET /grids. */
export async function getBotParameters(params: GetBotParametersParams): Promise<string> {
  const botModes = BOT_MODES.map(m => `  - ${m}: ${botModeLabels[m]}`).join('\n');
  const gridModes = GRID_MODES.map(m => `  - ${m}: ${gridModeLabels[m]}`).join('\n');
  let grids: string;
  try {
    const list = await getApiClient().listGrids(params.user_id);
    grids = list.length > 0
      ? list.map(g => `  - ID: ${g.id}, Name: ${g.name} (User: ${g.user_id}, bots: ${g.bots_count})`).join('\n')
      : '  No grids found';
  } catch (error) {
    grids = `  ${apiErrorText('fetching grids', error)}`;
  }
  return `Bot Parameters:

Bot Modes (lm/sm):
${botModes}

Grid Modes:
${gridModes}

Market Types: ${MARKET_TYPES.join(', ')}

Limits (PUT /bots/{id}): name up to ${BOT_LIMITS.nameMax} characters, wallet exposure 0-${BOT_LIMITS.weMax}, leverage 1-${BOT_LIMITS.leverageMax}

Available Grids${params.user_id ? ` of user ${params.user_id}` : ''}:
${grids}

Symbols: use list_exchange_symbols with the exchange_id of the account.

Notes:
  - create_bot requires a grid_id when grid_mode is "custom".
  - Changes to a running bot reach Passivbot only after a restart (update_bot with restart=true, or restart_bot).`;
}

export async function listBots(params: ListBotsParams): Promise<string> {
  if (!params.user_id && !params.exchange_id) {
    return 'Error: Either user_id or exchange_id is required.';
  }
  const filterDesc = params.exchange_id ? `exchange ${params.exchange_id}` : `user ${params.user_id}`;
  try {
    const bots = await getApiClient().listBots({ user_id: params.user_id, exchange_id: params.exchange_id });
    if (bots.length === 0) {
      return `No bots found for ${filterDesc}.`;
    }

    const names = new Map<number, string>();
    const exchangeIds = [...new Set(bots.map(b => b.exchange_id))].filter(id => id > 0);
    if (exchangeIds.length <= MAX_SYMBOL_LOOKUPS) {
      for (const exchangeId of exchangeIds) {
        try {
          for (const [id, name] of await symbolNames(exchangeId)) {
            names.set(id, name);
          }
        } catch {
          // keep symbol ids if the lookup fails
        }
      }
    }

    const onCount = bots.filter(isRunningFlag).length;
    const lines = bots.map(b => formatBotLine(b, names)).join('\n');
    return `Bots for ${filterDesc} (Total: ${bots.length}, ON per database: ${onCount}):
${lines}

Status is the database flag (started_at + pid); use get_bot_status for a live process check.
Modes: n=Normal, m=Manual, gs=Graceful Stop, t=Take Profit Only, p=Panic.`;
  } catch (error) {
    return apiErrorText('fetching bots', error);
  }
}

export async function getBot(params: GetBotParams): Promise<string> {
  try {
    const client = getApiClient();
    const bot = await client.getBot(params.id);
    let status: BotStatus | null = null;
    let statusError: string | null = null;
    try {
      status = await client.getBotStatus(params.id);
    } catch (error) {
      statusError = error instanceof Error ? error.message : String(error);
    }
    return formatBotDetailed(bot, status, statusError);
  } catch (error) {
    return apiErrorText('fetching bot', error, `Bot with ID ${params.id} not found.`);
  }
}

export async function createBot(params: CreateBotParams): Promise<string> {
  if (params.symbol_id === undefined && !params.symbol) {
    return 'Error: pass symbol_id or symbol.';
  }
  if (params.grid_mode === 'custom' && !params.grid_id) {
    return 'Error: grid_id is required when grid_mode is "custom" (see list_grids).';
  }
  try {
    const client = getApiClient();
    // POST /bots does no validation and does not set the owner: take it from the exchange.
    const exchange = await client.getExchange(params.exchange_id);
    const symbol = await resolveSymbol(params.exchange_id, params.symbol_id, params.symbol);
    if (typeof symbol === 'string') {
      return `Error: ${symbol}`;
    }
    const taken = await symbolTakenBy(params.exchange_id, symbol.id);
    if (taken) {
      return `Error: exchange ${params.exchange_id} already has bot #${taken.id} (${taken.name}) on ${symbol.name}. Only one bot per symbol and account.`;
    }
    const bot = await client.createBot({
      user_id: exchange.user_id,
      name: params.name,
      exchange_id: params.exchange_id,
      symbol_id: symbol.id,
      market_type: params.market_type,
      grid_mode: params.grid_mode,
      grid_id: params.grid_id ?? null,
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
    return `Bot created successfully (symbol ${symbol.name}):
${formatBotSummary(bot)}

Note: Bot is created in STOPPED state. Use start_bot to start it.`;
  } catch (error) {
    return apiErrorText('creating bot', error, `Exchange with ID ${params.exchange_id} not found.`);
  }
}

export async function updateBot(params: UpdateBotParams): Promise<string> {
  const { id, restart, ...fields } = params;
  const updateData: BotUpdateData = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(updateData).length === 0) {
    return 'Nothing to update: pass at least one field besides id and restart.';
  }
  try {
    const client = getApiClient();
    if (updateData.symbol_id !== undefined || updateData.symbol !== undefined) {
      const current = await client.getBot(id);
      const symbol = await resolveSymbol(current.exchange_id, updateData.symbol_id, updateData.symbol);
      if (typeof symbol === 'string') {
        return `Error: ${symbol}`;
      }
      const taken = await symbolTakenBy(current.exchange_id, symbol.id, id);
      if (taken) {
        return `Error: exchange ${current.exchange_id} already has bot #${taken.id} (${taken.name}) on ${symbol.name}. Only one bot per symbol and account.`;
      }
      delete updateData.symbol;
      updateData.symbol_id = symbol.id;
    }
    const result = await client.updateBot(id, { ...updateData, restart });
    const restartNote = result.restarted === true
      ? 'The bot was restarted and Passivbot loaded the change.'
      : result.restarted === false
        ? 'WARNING: the restart failed; check the bot with get_bot_status.'
        : isRunningFlag(result.bot)
          ? 'Not restarted: Passivbot keeps the previous settings until restart_bot (or update_bot with restart=true).'
          : 'The bot is stopped; the change applies on the next start.';
    return `Bot updated successfully:
${formatBotSummary(result.bot)}

${restartNote}`;
  } catch (error) {
    return apiErrorText('updating bot', error, `Bot with ID ${id} not found.`);
  }
}

export async function startBot(params: BotIdParams): Promise<string> {
  try {
    const result = await getApiClient().startBot(params.id);
    const headline = result.already_running ? 'Bot was already running.' : result.success ? 'Bot started.' : 'Bot start reported failure.';
    return `${headline}
- ID: ${result.bot.id}
- Name: ${result.bot.name}
- PID: ${result.bot.pid ?? 'N/A'}
- Started At: ${result.bot.started_at ?? 'N/A'}`;
  } catch (error) {
    return apiErrorText('starting bot', error, `Bot with ID ${params.id} not found.`);
  }
}

export async function stopBot(params: BotIdParams): Promise<string> {
  try {
    const result = await getApiClient().stopBot(params.id);
    return `${result.success ? 'Bot stopped.' : 'WARNING: the bot still appears as running.'}
- ID: ${result.bot.id}
- Name: ${result.bot.name}
- Database flag: ${stateText(result.bot)}
- Stopped At: ${result.bot.stopped_at ?? 'N/A'}`;
  } catch (error) {
    return apiErrorText('stopping bot', error, `Bot with ID ${params.id} not found.`);
  }
}

export async function restartBot(params: BotIdParams): Promise<string> {
  try {
    const result = await getApiClient().restartBot(params.id);
    return `${result.success ? 'Bot restarted.' : 'Bot restart reported failure.'}
- ID: ${result.bot.id}
- Name: ${result.bot.name}
- PID: ${result.bot.pid ?? 'N/A'}
- Started At: ${result.bot.started_at ?? 'N/A'}`;
  } catch (error) {
    return apiErrorText('restarting bot', error, `Bot with ID ${params.id} not found.`);
  }
}

export async function getBotStatus(params: BotIdParams): Promise<string> {
  try {
    const status = await getApiClient().getBotStatus(params.id);
    return `Bot Status (ID: ${params.id}):
- Process Running: ${status.running ? 'YES' : 'NO'}
- PID: ${status.pid ?? 'N/A'}
- Started At: ${status.started_at ?? 'N/A'}
- Symbol: ${status.symbol ?? 'N/A'}
- Long: ${modeText(status.lm)}, wallet exposure ${status.lwe}
- Short: ${modeText(status.sm)}, wallet exposure ${status.swe}
- Leverage: ${status.leverage}x`;
  } catch (error) {
    return apiErrorText('fetching bot status', error, `Bot with ID ${params.id} not found.`);
  }
}
