import { ApiError, getApiClient, type Bot } from '../api/client.js';

// Mirrors antbot's enums (app/Enums) and labels (config/antbot.php).
export const EXCHANGES = ['bybit', 'binance', 'binance_us', 'bitget', 'okx'] as const;
export const RISK_MODES = ['1', '2', '3'] as const;
export const BOT_MODES = ['n', 'm', 'gs', 't', 'p'] as const;
export const GRID_MODES = ['recursive', 'neat', 'static', 'clock', 'custom'] as const;
export const MARKET_TYPES = ['futures', 'spot'] as const;

export const riskModeLabels: Record<string, string> = {
  '1': 'Conservative',
  '2': 'Moderate',
  '3': 'Kamikaze',
};

export const botModeLabels: Record<string, string> = {
  'n': 'Normal',
  'm': 'Manual',
  'gs': 'Graceful Stop',
  't': 'Take Profit Only',
  'p': 'Panic',
};

export const gridModeLabels: Record<string, string> = {
  'recursive': 'Recursive',
  'neat': 'Neat',
  'static': 'Static',
  'clock': 'Clock',
  'custom': 'Custom',
};

export const roleLabels: Record<string, string> = {
  '1': 'Admin',
  '2': 'User',
};

/**
 * Limits enforced by PUT /bots/{id} (AdminApiController::updateBot). create_bot uses them too,
 * because POST /bots does no validation at all. Bot names are varchar(30) in the database.
 */
export const BOT_LIMITS = {
  nameMax: 30,
  weMax: 2,
  leverageMax: 20,
} as const;

export function yesNo(value: unknown): string {
  return value === true || value === 1 || value === '1' ? 'Yes' : 'No';
}

export function signed(value: number, digits: number = 4): string {
  return value >= 0 ? `+${value.toFixed(digits)}` : value.toFixed(digits);
}

/** Same rule as Trade::getNiceNameAttribute: "TAOUSDT_UMCBL" → "TAOUSDT", "BTC-USDT-SWAP" → "BTCUSDT". */
export function niceSymbol(raw: string): string {
  return raw.replace('-SWAP', '').replace(/-/g, '').replace('_UMCBL', '');
}

/** Same rule as Bot::getIsRunningAttribute (database flag; GET /bots/{id}/status also checks the process). */
export function isRunningFlag(bot: Bot): boolean {
  return Boolean(bot.started_at) && (bot.pid ?? 0) > 0;
}

export function apiErrorText(action: string, error: unknown, notFound?: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404 && notFound) {
      return notFound;
    }
    return `Error ${action}: ${error.message}`;
  }
  throw error;
}

const SYMBOL_CACHE_MS = 10 * 60_000;
const symbolCache = new Map<number, { at: number; names: Map<number, string> }>();

/**
 * Symbol id → short name ("ALGOUSDT") for the exchange type of an account. Cached for ten minutes,
 * because the list is long and rarely changes.
 */
export async function symbolNames(exchangeId: number): Promise<Map<number, string>> {
  const cached = symbolCache.get(exchangeId);
  if (cached && Date.now() - cached.at < SYMBOL_CACHE_MS) {
    return cached.names;
  }
  const symbols = await getApiClient().listExchangeSymbols(exchangeId);
  const names = new Map(symbols.map(s => [s.id, s.nice_name] as [number, string]));
  symbolCache.set(exchangeId, { at: Date.now(), names });
  return names;
}
