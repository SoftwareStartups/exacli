import { deleteSecret } from '../../auth/keychain.js';
import * as format from '../../formatters/markdown.js';

export async function logout(): Promise<void> {
  const deleted = await deleteSecret('EXA_API_KEY');

  if (!deleted) {
    console.log('No stored API key found. Already logged out.');
    return;
  }

  console.log(await format.formatSuccess('API key removed.'));

  if (process.env.EXA_API_KEY) {
    console.log('Note: EXA_API_KEY environment variable is still set.');
  }
}
