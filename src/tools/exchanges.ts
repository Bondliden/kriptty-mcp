import { z } from 'zod';
import { getApiClient, type Exchange } from '../api/client.js';
import { apiErrorText, EXCHANGES, RISK_MODES, riskModeLabels, signed, yesNo } from './common.js';

export const getExchangeParametersSchema = z.object({});

export const listExchangesSchema = z.object({
  user_id: z.number().int().positive().describe('User ID to list exchanges for'),
});

export const getExchangeSchema = z.object({
  id: z.number().int().positive().describe('Exchange ID'),
});

export const createExchangeSchema = z.object({
  user_id: z.number().int().positive().describe('User ID'),
  name: z.string().min(1).max(255).describe('Exchange name'),
  exchange: z.enum(EXCHANGES).describe('Exchange type'),
  risk_mode: z.enum(RISK_MODES).describe('Risk mode: 1=Conservative, 2=Moderate, 3=Kamikaze'),
  api_key: z.string().min(1).max(100).describe('API key'),
  api_secret: z.string().min(1).max(100).describe('API secret'),
  api_frase: z.string().max(250).optional().describe('API passphrase (OKX and Bitget)'),
});

export const updateExchangeSchema = z.object({
  id: z.number().int().positive().describe('Exchange ID'),
  name: z.string().min(1).max(255).optional().describe('Exchange name'),
  exchange: z.enum(EXCHANGES).optional().describe('Exchange type'),
  risk_mode: z.enum(RISK_MODES).optional().describe('Risk mode: 1=Conservative, 2=Moderate, 3=Kamikaze'),
  api_key: z.string().min(1).max(100).optional().describe('API key'),
  api_secret: z.string().min(1).max(100).optional().describe('API secret'),
  api_frase: z.string().max(250).optional().describe('API passphrase (OKX and Bitget)'),
});

export const refreshExchangeSchema = z.object({
  id: z.number().int().positive().describe('Exchange ID'),
});

export const listExchangeSymbolsSchema = z.object({
  exchange_id: z.number().int().positive().describe('Exchange ID (account); symbols come from its exchange type'),
  q: z.string().min(1).max(20).optional().describe('Filter by part of the short name, e.g. "ALGO" or "BTC"'),
});

export const listPositionsSchema = z.object({
  exchange_id: z.number().int().positive().describe('Exchange ID'),
});

export type ListExchangesParams = z.infer<typeof listExchangesSchema>;
export type GetExchangeParams = z.infer<typeof getExchangeSchema>;
export type CreateExchangeParams = z.infer<typeof createExchangeSchema>;
export type UpdateExchangeParams = z.infer<typeof updateExchangeSchema>;
export type RefreshExchangeParams = z.infer<typeof refreshExchangeSchema>;
export type ListExchangeSymbolsParams = z.infer<typeof listExchangeSymbolsSchema>;
export type ListPositionsParams = z.infer<typeof listPositionsSchema>;

const MAX_SYMBOLS_LISTED = 300;

function riskModeText(riskMode: number | string): string {
  return riskModeLabels[String(riskMode)] || String(riskMode);
}

function formatExchange(exchange: Exchange): string {
  return `- ID: ${exchange.id}
  Name: ${exchange.name}
  Exchange: ${exchange.exchange}
  Risk Mode: ${riskModeText(exchange.risk_mode)}
  Testnet: ${yesNo(exchange.is_testnet)}
  API Error: ${exchange.api_error ? 'Yes (credentials may be invalid or the balance sync failed)' : 'No'}
  USDT Balance: ${exchange.usdt_balance || 'N/A'}
  Created: ${exchange.created_at}`;
}

function formatExchangeDetailed(exchange: Exchange): string {
  return `- ID: ${exchange.id}
- User ID: ${exchange.user_id}
- Name: ${exchange.name}
- Slug: ${exchange.slug || 'N/A'}
- Exchange Type: ${exchange.exchange}
- Risk Mode: ${riskModeText(exchange.risk_mode)}
- Testnet: ${yesNo(exchange.is_testnet)}
- API Error: ${exchange.api_error ? 'Yes (credentials may be invalid or the balance sync failed)' : 'No'}
- Balances:
  - USDT: ${exchange.usdt_balance || 'N/A'}
  - USD: ${exchange.usd_balance || 'N/A'}
  - BTC: ${exchange.btc_balance || 'N/A'}
  - ETH: ${exchange.eth_balance || 'N/A'}
- Initial USDT Balance: ${exchange.initial_usdt_balance || 'Not recorded'}
- Initial Balance Date: ${exchange.initial_balance_recorded_at || 'N/A'}
- Created: ${exchange.created_at}
- Updated: ${exchange.updated_at}`;
}

/** The admin API has no parameters endpoint: these come from antbot's enums and Exchange model. */
export function getExchangeParameters(): string {
  const exchanges = EXCHANGES.map(e => `  - ${e}`).join('\n');
  const riskModes = RISK_MODES.map(r => `  - ${r}: ${riskModeLabels[r]}`).join('\n');
  return `Exchange Parameters:

Supported Exchanges:
${exchanges}

Risk Modes:
${riskModes}

Required Fields: user_id, name, exchange, risk_mode, api_key, api_secret
Optional Fields: api_frase

Notes:
  - api_frase: passphrase, needed for OKX and Bitget
  - The admin API only mass-assigns name, exchange, risk_mode, api_key, api_secret and api_frase
    (Exchange::$fillable). It drops user_id, so POST /exchanges fails until AdminApiController::createExchange
    sets it explicitly; is_testnet cannot be set through the API either.
  - API keys are hidden in every response.`;
}

export async function listExchanges(params: ListExchangesParams): Promise<string> {
  try {
    const exchanges = await getApiClient().listExchanges(params.user_id);
    if (exchanges.length === 0) {
      return `No exchanges found for user ${params.user_id}.`;
    }
    const exchangesSummary = exchanges.map(formatExchange).join('\n\n');
    return `Exchanges for User ${params.user_id} (Total: ${exchanges.length}):\n\n${exchangesSummary}`;
  } catch (error) {
    return apiErrorText('fetching exchanges', error);
  }
}

export async function getExchange(params: GetExchangeParams): Promise<string> {
  try {
    const exchange = await getApiClient().getExchange(params.id);
    return `Exchange Details:\n${formatExchangeDetailed(exchange)}`;
  } catch (error) {
    return apiErrorText('fetching exchange', error, `Exchange with ID ${params.id} not found.`);
  }
}

export async function createExchange(params: CreateExchangeParams): Promise<string> {
  try {
    const exchange = await getApiClient().createExchange({
      user_id: params.user_id,
      name: params.name,
      exchange: params.exchange,
      risk_mode: params.risk_mode,
      api_key: params.api_key,
      api_secret: params.api_secret,
      api_frase: params.api_frase,
    });
    return `Exchange created:\n${formatExchangeDetailed(exchange)}`;
  } catch (error) {
    return apiErrorText('creating exchange', error);
  }
}

export async function updateExchange(params: UpdateExchangeParams): Promise<string> {
  const { id, ...fields } = params;
  const updateData = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  if (Object.keys(updateData).length === 0) {
    return 'Nothing to update: pass at least one field besides id.';
  }
  try {
    const exchange = await getApiClient().updateExchange(id, updateData);
    return `Exchange updated:\n${formatExchangeDetailed(exchange)}`;
  } catch (error) {
    return apiErrorText('updating exchange', error, `Exchange with ID ${id} not found.`);
  }
}

export async function refreshExchange(params: RefreshExchangeParams): Promise<string> {
  try {
    const result = await getApiClient().refreshExchange(params.id);
    const exchange = result.exchange;
    return `Refresh acknowledged (success: ${result.success ? 'yes' : 'no'}). Note: the current admin API only returns the stored exchange; it does not re-sync the balance.
- ID: ${exchange.id}
- Name: ${exchange.name}
- API Error: ${exchange.api_error ? 'Yes' : 'No'}
- USDT Balance: ${exchange.usdt_balance || 'N/A'}
- Updated: ${exchange.updated_at}`;
  } catch (error) {
    return apiErrorText('refreshing exchange', error, `Exchange with ID ${params.id} not found.`);
  }
}

export async function listExchangeSymbols(params: ListExchangeSymbolsParams): Promise<string> {
  try {
    const symbols = await getApiClient().listExchangeSymbols(params.exchange_id, params.q);
    if (symbols.length === 0) {
      return `No symbols found for exchange ${params.exchange_id}${params.q ? ` matching "${params.q}"` : ''}.`;
    }
    const shown = symbols.slice(0, MAX_SYMBOLS_LISTED);
    const more = symbols.length > shown.length
      ? `\n... and ${symbols.length - shown.length} more (use q to narrow the list)`
      : '';
    return `Symbols for exchange ${params.exchange_id}${params.q ? ` matching "${params.q}"` : ''} (Total: ${symbols.length}):\n${shown.map(s => `- ID: ${s.id}, ${s.nice_name} (${s.name})`).join('\n')}${more}`;
  } catch (error) {
    return apiErrorText('fetching symbols', error, `Exchange with ID ${params.exchange_id} not found.`);
  }
}

export async function listPositions(params: ListPositionsParams): Promise<string> {
  try {
    const positions = await getApiClient().listPositions(params.exchange_id);
    if (positions.length === 0) {
      return `No open positions for exchange ${params.exchange_id} (positions are synced every 5 minutes).`;
    }
    const totalPnl = positions.reduce((sum, p) => sum + (Number(p.unrealised_pnl) || 0), 0);
    const lines = positions.map(p =>
      `- ${p.symbol} ${p.side} | Size: ${p.size} | Entry: ${p.entry_price} | Liq: ${p.liq_price || 'N/A'} | Value: ${p.position_value} | uPnL: ${signed(Number(p.unrealised_pnl) || 0)} | Leverage: ${p.leverage ?? 'N/A'}x | Updated: ${p.updated_at}`
    ).join('\n');
    return `Open positions for exchange ${params.exchange_id} (Total: ${positions.length}, unrealised PnL: ${signed(totalPnl)}):\n${lines}`;
  } catch (error) {
    return apiErrorText('fetching positions', error, `Exchange with ID ${params.exchange_id} not found.`);
  }
}
