import { z } from 'zod';
import { getApiClient, type User } from '../api/client.js';
import { apiErrorText, roleLabels, yesNo } from './common.js';

export const listUsersSchema = z.object({});

export const getUserSchema = z.object({
  id: z.number().int().positive().describe('User ID'),
});

export const createUserSchema = z.object({
  name: z.string().min(1).max(255).describe('User name'),
  email: z.string().email().describe('User email'),
  password: z.string().min(8).describe('User password (min 8 characters)'),
  role: z.number().int().min(1).max(2).default(2).describe('Role: 1=Admin, 2=User (default: 2)'),
  admin: z.boolean().optional().default(false).describe('Is admin (default: false)'),
});

export const updateUserEmailSchema = z.object({
  user_id: z.number().int().positive().describe('User ID'),
  email: z.string().email().describe('New email'),
});

export const updateUserNameSchema = z.object({
  user_id: z.number().int().positive().describe('User ID'),
  name: z.string().min(1).max(255).describe('New name'),
});

export const updateUserPasswordSchema = z.object({
  user_id: z.number().int().positive().describe('User ID'),
  password: z.string().min(8).describe('New password (min 8 characters)'),
});

export const updateUserAdminSchema = z.object({
  user_id: z.number().int().positive().describe('User ID'),
  admin: z.boolean().describe('Admin status'),
});

export const updateUserRoleSchema = z.object({
  user_id: z.number().int().positive().describe('User ID'),
  role: z.number().int().min(1).max(2).describe('New role: 1=Admin, 2=User'),
});

export const listRolesSchema = z.object({});

export type GetUserParams = z.infer<typeof getUserSchema>;
export type CreateUserParams = z.infer<typeof createUserSchema>;
export type UpdateUserEmailParams = z.infer<typeof updateUserEmailSchema>;
export type UpdateUserNameParams = z.infer<typeof updateUserNameSchema>;
export type UpdateUserPasswordParams = z.infer<typeof updateUserPasswordSchema>;
export type UpdateUserAdminParams = z.infer<typeof updateUserAdminSchema>;
export type UpdateUserRoleParams = z.infer<typeof updateUserRoleSchema>;

function roleText(role: number): string {
  return roleLabels[String(role)] ? `${role} (${roleLabels[String(role)]})` : String(role);
}

// Only these fields are ever printed: the API response also carries 2FA secrets.
function formatUser(user: User): string {
  return `- ID: ${user.id}
- Name: ${user.name}
- Email: ${user.email}
- Admin: ${yesNo(user.admin)}
- Role: ${roleText(user.role)}
- Main exchange ID: ${user.exchange_id || 'None'}
- Timezone: ${user.timezone || 'Not set'}
- 2FA confirmed: ${yesNo(user.two_factor_confirmed)}
- Last Seen: ${user.last_seen || 'Never'}
- Created: ${user.created_at}
- Updated: ${user.updated_at}`;
}

export async function listUsers(): Promise<string> {
  try {
    const response = await getApiClient().listUsers();
    const usersSummary = response.data.map(user =>
      `- ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Admin: ${yesNo(user.admin)}, Role: ${roleText(user.role)}, Main exchange ID: ${user.exchange_id || 'None'}`
    ).join('\n');
    return `Users (Total: ${response.data.length}):\n\n${usersSummary}\n\nUse list_exchanges with a user_id to see all exchanges of a user.`;
  } catch (error) {
    return apiErrorText('fetching users', error);
  }
}

export async function getUser(params: GetUserParams): Promise<string> {
  try {
    const user = await getApiClient().getUser(params.id);
    return `User Details:\n${formatUser(user)}`;
  } catch (error) {
    return apiErrorText('fetching user', error, `User with ID ${params.id} not found.`);
  }
}

export async function createUser(params: CreateUserParams): Promise<string> {
  try {
    const user = await getApiClient().createUser({
      name: params.name,
      email: params.email,
      password: params.password,
      role: params.role,
      admin: params.admin,
    });
    return `User created successfully:\n${formatUser(user)}`;
  } catch (error) {
    return apiErrorText('creating user', error);
  }
}

export async function updateUserEmail(params: UpdateUserEmailParams): Promise<string> {
  try {
    const user = await getApiClient().updateUserEmail(params.user_id, params.email);
    return `User ${user.id} email updated to: ${user.email}`;
  } catch (error) {
    return apiErrorText('updating email', error, `User with ID ${params.user_id} not found.`);
  }
}

export async function updateUserName(params: UpdateUserNameParams): Promise<string> {
  try {
    const user = await getApiClient().updateUserName(params.user_id, params.name);
    return `User ${user.id} name updated to: ${user.name}`;
  } catch (error) {
    return apiErrorText('updating name', error, `User with ID ${params.user_id} not found.`);
  }
}

export async function updateUserPassword(params: UpdateUserPasswordParams): Promise<string> {
  try {
    const result = await getApiClient().updateUserPassword(params.user_id, params.password);
    return result?.success
      ? `User ${params.user_id} password updated successfully.`
      : `The API did not confirm the password change for user ${params.user_id}.`;
  } catch (error) {
    return apiErrorText('updating password', error, `User with ID ${params.user_id} not found.`);
  }
}

export async function updateUserAdmin(params: UpdateUserAdminParams): Promise<string> {
  try {
    const user = await getApiClient().updateUserAdmin(params.user_id, params.admin);
    return `User ${user.id} admin status set to: ${yesNo(user.admin)}`;
  } catch (error) {
    return apiErrorText('updating admin status', error, `User with ID ${params.user_id} not found.`);
  }
}

export async function updateUserRole(params: UpdateUserRoleParams): Promise<string> {
  try {
    const user = await getApiClient().updateUserRole(params.user_id, params.role);
    return `User ${user.id} role updated to: ${roleText(user.role)}`;
  } catch (error) {
    return apiErrorText('updating role', error, `User with ID ${params.user_id} not found.`);
  }
}

export async function listRoles(): Promise<string> {
  try {
    const roles = await getApiClient().listRoles();
    return `Available Roles:\n${roles.map(r => `- Role ${r.id}: ${r.name}`).join('\n')}`;
  } catch (error) {
    return apiErrorText('fetching roles', error);
  }
}
