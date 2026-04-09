import axios, { AxiosInstance } from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { useMemo, useRef, useEffect } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Returns a stable Axios instance (created once) that always attaches the
 * Clerk JWT to every request via Authorization: Bearer <token>.
 *
 * The interceptor is registered synchronously inside useMemo so it is
 * guaranteed to be in place before the first API call — unlike useEffect
 * which fires after mount and can lose the race against data-fetching effects.
 */
export function useApi(): AxiosInstance {
  const { getToken } = useAuth();

  // Keep a ref so the interceptor closure always reads the latest getToken
  // without the axios instance needing to be recreated.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  return useMemo(() => {
    const instance = axios.create({ baseURL: `${API_URL}/api/v1` });

    instance.interceptors.request.use(async (config) => {
      const token = await getTokenRef.current();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    return instance;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
