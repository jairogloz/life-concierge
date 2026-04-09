import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

/**
 * Clerk token cache backed by expo-secure-store.
 * Keys are sanitised because SecureStore only accepts alphanumeric + ._-.
 */
function sanitiseKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(sanitiseKey(key));
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(sanitiseKey(key), value);
    } catch {
      // ignore write errors
    }
  },
};
