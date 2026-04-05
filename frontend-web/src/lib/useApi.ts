import axios from 'axios';
import { useEffect, useMemo, useRef } from 'react';
import { useSession } from '@clerk/clerk-react';

/**
 * Returns a stable Axios instance (created once) scoped to /api/v1.
 * The request interceptor reads the session via a ref so it always has
 * the latest session object regardless of when Clerk finishes loading.
 */
export function useApi() {
  const { session } = useSession();
  const sessionRef = useRef(session);

  // Keep the ref in sync on every render — no recreating the axios instance.
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  return useMemo(() => {
    const instance = axios.create({ baseURL: '/api/v1' });

    instance.interceptors.request.use(async (config) => {
      const token = await sessionRef.current?.getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    return instance;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
