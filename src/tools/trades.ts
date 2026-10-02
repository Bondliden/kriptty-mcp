import { z } from 'zod';
import { getApiClient, type Trade } from '../api/client.js';
import { apiErrorText, niceSymbol, signed } from './common.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const listTradesSchema = z.object({
  exchange_id: z.number().int().positive().describe('Exchange ID (required)'),
  symbol: z.string().min(1).max(40).optional().describe('Filter by symbol: short name (e.g. "BTCUSDT") or exchange name (e.g. "BTCUSDT_UMCBL")'),
  from_date: isoDate.optional().describe('Start date filter on created_at (YYYY-MM-DD)'),
  to_date: isoDate.optional().describe('End date filter on created_at (YYYY-MM-DD)'),
  per_page: z.number().int().min(1).max(100).optional().describe('Records per page (default: 25, max: 100)'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1). Newest trades first.'),
});

export const getTradeSchema = z.object({
  id: z.number().int().positive().describe('Trade ID'),
});

export const listTradeSymbolsSchema = z.object({
  exchange_id: z.number().int().positive().describe('Exchange ID'),
});

export const getPnlStatsSchema = z.object({
  exchange_id: z.number().int().positive().describe('Exchange ID (required)'),
  period: z.enum(['daily', 'monthly', 'yearly']).default('daily').describe('Aggregation period (default: daily)'),
  year: z.number().int().min(2020).max(2100).optional().describe('Year filter (daily and monthly default to the current year)'),
  month: z.number().int().min(1).max(12).optional().describe('Month filter (1-12; daily defaults to the current month when year is also omitted)'),
});

export type ListTradesParams = z.infer<typeof listTradesSchema>;
export type GetTradeParams = z.infer<typeof getTradeSchema>;
export type ListTradeSymbolsParams = z.infer<typeof listTradeSymbolsSchema>;
export type GetPnlStatsParams = z.infer<typeof getPnlStatsSchema>;

const MAX_PERIODS_SHOWN = 62;
const TOP_SYMBOLS_PER_PERIOD = 3;
const TOP_SYMBOLS_OVERALL = 15;

function tradeCount(count: number): string {
  return `${count} trade${count === 1 ? '' : 's'}`;
}

function pnlOf(trade: Trade): number {
  const pnl = parseFloat(trade.closed_pnl ?? '');
  return Number.isFinite(pnl) ? pnl : 0;
}

function formatTrade(trade: Trade): string {
  return `- ID: ${trade.id} | ${niceSymbol(trade.symbol)} | ${trade.side} | Qty: ${trade.qty || 'N/A'} | Price: ${trade.order_price ?? 'N/A'} | PnL: ${signed(pnlOf(trade))} | ${trade.created_at}`;
}

function formatTradeDetailed(trade: Trade): string {
  return `Trade Details:
- ID: ${trade.id}
- Exchange ID: ${trade.exchange_id}
- Position ID: ${trade.position_id}
- Symbol: ${trade.symbol} (${niceSymbol(trade.symbol)})
- Side: ${trade.side}
- Order Type: ${trade.order_type}
- Exec Type: ${trade.exec_type}
- Quantity: ${trade.qty || 'N/A'}
- Order Price: ${trade.order_price ?? 'N/A'}
- Avg Entry Price: ${trade.avg_entry_price || 'N/A'}
- Avg Exit Price: ${trade.avg_exit_price || 'N/A'}
- Closed Size: ${trade.closed_size || 'N/A'}
- Closed PnL: ${signed(pnlOf(trade))}
- Leverage: ${trade.leverage ?? 'N/A'}x
- Fill Count: ${trade.fill_count ?? 'N/A'}
- Order ID: ${trade.order_id}
- Order OID: ${trade.order_oid || 'N/A'}
- Created: ${trade.created_at}
- Updated: ${trade.updated_at}`;
}

export async function listTrades(params: ListTradesParams): Promise<string> {
  try {
    const client = getApiClient();
    let symbol: string | undefined;
    if (params.symbol) {
      // The API filters on the exact exchange symbol ("BTCUSDT_UMCBL"), so map short names first.
      const traded = await client.listTradeSymbols(params.exchange_id);
      const wanted = params.symbol.toUpperCase();
      symbol = traded.find(s => s === params.symbol) ?? traded.find(s => niceSymbol(s).toUpperCase() === wanted);
      if (!symbol) {
        return `No trades with symbol ${params.symbol} on exchange ${params.exchange_id} (see list_trade_symbols).`;
      }
    }
    const page = await client.listTrades(params.exchange_id, {
      symbol,
      from_date: params.from_date,
      to_date: params.to_date,
      per_page: params.per_page,
      page: params.page,
    });
    if (page.data.length === 0) {
      return page.total > 0
        ? `Page ${page.current_page} is empty: exchange ${params.exchange_id} has ${page.total} matching trades in ${page.last_page} pages.`
        : `No trades found for exchange ${params.exchange_id}${symbol ? ` with symbol ${symbol}` : ''}.`;
    }
    return `Trades for Exchange ${params.exchange_id}${symbol ? ` (${symbol})` : ''} (Page ${page.current_page}/${page.last_page}, Total: ${page.total}):

${page.data.map(formatTrade).join('\n')}

Pagination: Showing ${page.from}-${page.to} of ${page.total} trades, newest first`;
  } catch (error) {
    return apiErrorText('fetching trades', error);
  }
}

export async function getTrade(params: GetTradeParams): Promise<string> {
  try {
    const trade = await getApiClient().getTrade(params.id);
    return formatTradeDetailed(trade);
  } catch (error) {
    return apiErrorText('fetching trade', error, `Trade with ID ${params.id} not found.`);
  }
}

export async function listTradeSymbols(params: ListTradeSymbolsParams): Promise<string> {
  try {
    const symbols = await getApiClient().listTradeSymbols(params.exchange_id);
    if (symbols.length === 0) {
      return `No traded symbols found for exchange ${params.exchange_id}.`;
    }
    const symbolsList = symbols.map(s => `  - ${niceSymbol(s)} (${s})`).join('\n');
    return `Traded Symbols for Exchange ${params.exchange_id} (Total: ${symbols.length}):\n\n${symbolsList}`;
  } catch (error) {
    return apiErrorText('fetching trade symbols', error);
  }
}

interface Bucket {
  trades: number;
  pnl: number;
  bySymbol: Map<string, { trades: number; pnl: number }>;
}

function addTo(bucket: Bucket, symbol: string, pnl: number): void {
  bucket.trades += 1;
  bucket.pnl += pnl;
  const entry = bucket.bySymbol.get(symbol) ?? { trades: 0, pnl: 0 };
  entry.trades += 1;
  entry.pnl += pnl;
  bucket.bySymbol.set(symbol, entry);
}

function newBucket(): Bucket {
  return { trades: 0, pnl: 0, bySymbol: new Map() };
}

function topSymbols(bucket: Bucket, count: number): [string, { trades: number; pnl: number }][] {
  return [...bucket.bySymbol.entries()].sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl)).slice(0, count);
}

/**
 * The API returns the raw trades of the period (GET /exchanges/{id}/pnl-stats?year=&month=);
 * the aggregation by period and symbol happens here.
 */
export async function getPnlStats(params: GetPnlStatsParams): Promise<string> {
  const now = new Date();
  let { year, month } = params;
  if (params.period === 'daily' && year === undefined && month === undefined) {
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  } else if (params.period !== 'yearly' && year === undefined) {
    year = now.getUTCFullYear();
  }
  const range = year === undefined
    ? (month === undefined ? 'all time' : `month ${month} of every year`)
    : month === undefined ? String(year) : `${year}-${String(month).padStart(2, '0')}`;

  try {
    const trades = await getApiClient().listPnlTrades(params.exchange_id, { year, month });
    if (trades.length === 0) {
      return `No trades found for exchange ${params.exchange_id} in ${range}.`;
    }

    const keyLength = params.period === 'daily' ? 10 : params.period === 'monthly' ? 7 : 4;
    const total = newBucket();
    const periods = new Map<string, Bucket>();
    for (const trade of trades) {
      const symbol = niceSymbol(trade.symbol);
      const pnl = pnlOf(trade);
      addTo(total, symbol, pnl);
      const key = trade.created_at.slice(0, keyLength);
      const bucket = periods.get(key) ?? newBucket();
      addTo(bucket, symbol, pnl);
      periods.set(key, bucket);
    }

    const sortedPeriods = [...periods.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const periodLines = sortedPeriods.slice(0, MAX_PERIODS_SHOWN).map(([key, bucket]) => {
      const top = topSymbols(bucket, TOP_SYMBOLS_PER_PERIOD).map(([s, v]) => `${s} ${signed(v.pnl)}`).join(', ');
      return `  ${key}: ${tradeCount(bucket.trades)}, PnL ${signed(bucket.pnl)} (top: ${top})`;
    }).join('\n');
    const morePeriods = sortedPeriods.length > MAX_PERIODS_SHOWN
      ? `\n  ... and ${sortedPeriods.length - MAX_PERIODS_SHOWN} older periods`
      : '';
    const symbolLines = topSymbols(total, TOP_SYMBOLS_OVERALL)
      .map(([s, v]) => `  ${s}: ${tradeCount(v.trades)}, PnL ${signed(v.pnl)}`)
      .join('\n');

    return `P&L for Exchange ${params.exchange_id} (${params.period}, ${range}): ${tradeCount(total.trades)}, PnL ${signed(total.pnl)}

By ${params.period === 'daily' ? 'day' : params.period === 'monthly' ? 'month' : 'year'} (newest first):
${periodLines}${morePeriods}

By symbol (top ${Math.min(TOP_SYMBOLS_OVERALL, total.bySymbol.size)} of ${total.bySymbol.size} by absolute PnL):
${symbolLines}

PnL is the sum of closed_pnl of the synced trades; dates are created_at (UTC).`;
  } catch (error) {
    return apiErrorText('fetching P&L statistics', error);
  }
}
