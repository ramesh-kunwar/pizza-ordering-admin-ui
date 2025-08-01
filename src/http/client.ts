import axios from "axios";
import { useAuthStore } from "../store";
import { AUTH_SERVICE } from "./api";

export const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const refreshToken = async () => {
  await axios.post(
    `${import.meta.env.VITE_BACKEND_API_URL}${AUTH_SERVICE}/auth/refresh`,
    {},
    {
      withCredentials: true,
    }
  );
};

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._isRetry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api.request(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._isRetry = true;
      isRefreshing = true;

      try {
        await refreshToken();
        processQueue(null, 'token');
        return api.request(originalRequest);
      } catch (err) {
        processQueue(err, null);
        console.error("Token refresh error", err);
        useAuthStore.getState().logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
