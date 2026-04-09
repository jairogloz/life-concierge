import axios, { AxiosInstance } from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { useRef, useEffect } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Returns an Axios instance that automatically attaches the Clerk JWT
 * to every request via Authorization: Bearer <token>.
 */
export function useApi(): AxiosInstance {
  const { getToken } = useAuth();

  const instanceRef = useRef<AxiosInstance>(
    axios.create({ baseURL: `${API_URL}/api/v1` })
  );

  useEffect(() => {
    const instance = instanceRef.current;
    const id = instance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });
    return () => instance.interceptors.request.eject(id);
  }, [getToken]);

  return instanceRef.current;
}
