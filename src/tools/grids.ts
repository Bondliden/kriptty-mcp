import { z } from 'zod';
import { getApiClient } from '../api/client.js';
import { apiErrorText } from './common.js';

export const listGridsSchema = z.object({
  user_id: z.number().int().positive().optional().describe('Only the grids of this user'),
});

export const getGridSchema = z.object({
  id: z.number().int().positive().describe('Grid ID'),
});

export type ListGridsParams = z.infer<typeof listGridsSchema>;
export type GetGridParams = z.infer<typeof getGridSchema>;

const MAX_CONFIG_CHARS = 12_000;

export async function listGrids(params: ListGridsParams): Promise<string> {
  try {
    const grids = await getApiClient().listGrids(params.user_id);
    if (grids.length === 0) {
      return `No grids found${params.user_id ? ` for user ${params.user_id}` : ''}.`;
    }
    const lines = grids.map(g =>
      `- ID: ${g.id}, Name: ${g.name}, User: ${g.user_id}, Bots using it: ${g.bots_count}, Updated: ${g.updated_at}${g.description ? `\n  ${g.description}` : ''}`
    ).join('\n');
    return `Grid configurations${params.user_id ? ` of user ${params.user_id}` : ''} (Total: ${grids.length}):\n${lines}`;
  } catch (error) {
    return apiErrorText('fetching grids', error);
  }
}

export async function getGrid(params: GetGridParams): Promise<string> {
  try {
    const grid = await getApiClient().getGrid(params.id);
    let config = JSON.stringify(grid.config, null, 2) ?? 'null';
    if (config.length > MAX_CONFIG_CHARS) {
      config = `${config.slice(0, MAX_CONFIG_CHARS)}\n... (truncated, ${config.length} characters in total)`;
    }
    return `Grid Details:
- ID: ${grid.id}
- Name: ${grid.name}
- User ID: ${grid.user_id}
- Description: ${grid.description || 'None'}
- Updated: ${grid.updated_at}

Passivbot config:
${config}`;
  } catch (error) {
    return apiErrorText('fetching grid', error, `Grid with ID ${params.id} not found.`);
  }
}
