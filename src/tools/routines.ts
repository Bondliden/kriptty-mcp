import { z } from 'zod';
import { getApiClient, type Routine, type RoutineAction } from '../api/client.js';
import { apiErrorText, BOT_LIMITS, BOT_MODES, botModeLabels, GRID_MODES, gridModeLabels } from './common.js';

const routineId = z.string().uuid().describe('Routine ID (UUID)');
const botMode = z.enum(BOT_MODES);
const walletExposure = z.number().min(0).max(BOT_LIMITS.weMax);

export const getRoutineParametersSchema = z.object({
  user_id: z.number().int().positive().optional().describe('Only list the grids of this user'),
});

export const listRoutinesSchema = z.object({
  user_id: z.number().int().positive().optional().describe('Only the routines of this user'),
});

export const getRoutineSchema = z.object({ id: routineId });

export const createRoutineSchema = z.object({
  user_id: z.number().int().positive().describe('User ID'),
  name: z.string().min(1).max(52).describe('Routine name'),
  grid_mode: z.enum(GRID_MODES).describe('Grid mode'),
  grid_id: z.number().int().min(0).describe('Grid ID (0 for none)'),
  lm: botMode.describe('Long mode: n=normal, m=manual, gs=graceful stop, t=take profit only, p=panic'),
  lwe: walletExposure.describe(`Long wallet exposure (0-${BOT_LIMITS.weMax})`),
  sm: botMode.describe('Short mode: n=normal, m=manual, gs=graceful stop, t=take profit only, p=panic'),
  swe: walletExposure.describe(`Short wallet exposure (0-${BOT_LIMITS.weMax})`),
});

export const updateRoutineSchema = z.object({
  id: routineId,
  name: z.string().min(1).max(52).optional().describe('Routine name'),
  grid_mode: z.enum(GRID_MODES).optional().describe('Grid mode'),
  grid_id: z.number().int().min(0).optional().describe('Grid ID (0 for none)'),
  lm: botMode.optional().describe('Long mode'),
  lwe: walletExposure.optional().describe(`Long wallet exposure (0-${BOT_LIMITS.weMax})`),
  sm: botMode.optional().describe('Short mode'),
  swe: walletExposure.optional().describe(`Short wallet exposure (0-${BOT_LIMITS.weMax})`),
});

export const runRoutineSchema = z.object({ id: routineId });

export type GetRoutineParametersParams = z.infer<typeof getRoutineParametersSchema>;
export type ListRoutinesParams = z.infer<typeof listRoutinesSchema>;
export type GetRoutineParams = z.infer<typeof getRoutineSchema>;
export type CreateRoutineParams = z.infer<typeof createRoutineSchema>;
export type UpdateRoutineParams = z.infer<typeof updateRoutineSchema>;
export type RunRoutineParams = z.infer<typeof runRoutineSchema>;

function actionText(action: RoutineAction | null | undefined): string {
  if (!action) {
    return 'no action';
  }
  return `${gridModeLabels[action.grid_mode] || action.grid_mode}, grid #${action.grid_id} | long ${action.lm} ${action.lwe} | short ${action.sm} ${action.swe}`;
}

function formatRoutine(routine: Routine): string {
  const action = routine.action;
  return `- ID: ${routine.id}
- Name: ${routine.name}
- User ID: ${routine.user_id}
- Type: ${routine.type}
- Grid Mode: ${action?.grid_mode ?? 'N/A'}
- Grid ID: ${action?.grid_id ?? 'N/A'}
- Long Mode: ${action?.lm ?? 'N/A'}, wallet exposure ${action?.lwe ?? 'N/A'}
- Short Mode: ${action?.sm ?? 'N/A'}, wallet exposure ${action?.swe ?? 'N/A'}
- Last Run: ${routine.triggered_at || 'Never'}
- Triggered By: ${routine.triggered_by || 'N/A'}
- Created: ${routine.created_at}`;
}

/** The admin API has no parameters endpoint: enums come from antbot, grids from GET /grids. */
export async function getRoutineParameters(params: GetRoutineParametersParams): Promise<string> {
  const gridModes = GRID_MODES.map(m => `  - ${m}: ${gridModeLabels[m]}`).join('\n');
  const botModes = BOT_MODES.map(m => `  - ${m}: ${botModeLabels[m]}`).join('\n');
  let grids: string;
  try {
    const list = await getApiClient().listGrids(params.user_id);
    grids = list.map(g => `  - ID: ${g.id}, Name: ${g.name}, User: ${g.user_id}`).join('\n') || '  (none)';
  } catch (error) {
    grids = `  ${apiErrorText('fetching grids', error)}`;
  }
  return `Routine Parameters:

Grid Modes:
${gridModes}

Bot Modes (for lm/sm):
${botModes}

Wallet exposure: 0-${BOT_LIMITS.weMax}

Available Grids${params.user_id ? ` of user ${params.user_id}` : ''}:
${grids}`;
}

export async function listRoutines(params: ListRoutinesParams): Promise<string> {
  try {
    const all = await getApiClient().listRoutines();
    const routines = params.user_id ? all.filter(r => r.user_id === params.user_id) : all;
    if (routines.length === 0) {
      return `No routines found${params.user_id ? ` for user ${params.user_id}` : ''}.`;
    }
    const lines = routines.map(r =>
      `- ${r.id} | ${r.name.trim()} | user ${r.user_id} | ${actionText(r.action)} | last run: ${r.triggered_at || 'never'}`
    ).join('\n');
    return `Routines${params.user_id ? ` of user ${params.user_id}` : ''} (Total: ${routines.length}):\n${lines}`;
  } catch (error) {
    return apiErrorText('fetching routines', error);
  }
}

export async function getRoutine(params: GetRoutineParams): Promise<string> {
  try {
    const routine = await getApiClient().getRoutine(params.id);
    return `Routine Details:\n${formatRoutine(routine)}`;
  } catch (error) {
    return apiErrorText('fetching routine', error, `Routine with ID ${params.id} not found.`);
  }
}

export async function createRoutine(params: CreateRoutineParams): Promise<string> {
  try {
    const routine = await getApiClient().createRoutine({
      user_id: params.user_id,
      name: params.name,
      type: 'passivbot',
      action: {
        grid_mode: params.grid_mode,
        grid_id: params.grid_id,
        lm: params.lm,
        lwe: params.lwe,
        sm: params.sm,
        swe: params.swe,
      },
    });
    return `Routine created successfully:\n${formatRoutine(routine)}`;
  } catch (error) {
    return apiErrorText('creating routine', error);
  }
}

export async function updateRoutine(params: UpdateRoutineParams): Promise<string> {
  const { id, name, ...actionFields } = params;
  const actionUpdates = Object.fromEntries(Object.entries(actionFields).filter(([, value]) => value !== undefined));
  if (name === undefined && Object.keys(actionUpdates).length === 0) {
    return 'Nothing to update: pass name or at least one action field.';
  }
  try {
    const client = getApiClient();
    const updateData: { name?: string; action?: RoutineAction } = {};
    if (name !== undefined) {
      updateData.name = name;
    }
    if (Object.keys(actionUpdates).length > 0) {
      // PUT /routines/{id} replaces the whole action JSON, so merge with the stored one first.
      const current = await client.getRoutine(id);
      updateData.action = { ...current.action, ...actionUpdates } as RoutineAction;
    }
    const routine = await client.updateRoutine(id, updateData);
    return `Routine updated successfully:\n${formatRoutine(routine)}`;
  } catch (error) {
    return apiErrorText('updating routine', error, `Routine with ID ${id} not found.`);
  }
}

export async function runRoutine(params: RunRoutineParams): Promise<string> {
  try {
    const result = await getApiClient().runRoutine(params.id);
    return `The API answered success=${result.success ? 'true' : 'false'}, but its current version does NOT execute the routine:
it only returns it (no bot was changed). Last real run: ${result.routine.triggered_at || 'never'}.
- Routine: ${result.routine.name} (${result.routine.id})
- Action: ${actionText(result.routine.action)}`;
  } catch (error) {
    return apiErrorText('running routine', error, `Routine with ID ${params.id} not found.`);
  }
}
