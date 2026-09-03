import axios from 'axios'
import { getToken, removeToken } from '@/core/storage/token-storage'

declare module 'axios' { interface AxiosRequestConfig { skipAuthSessionHandling?: boolean } }

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000,
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(undefined, (error) => {
  if (error.response?.status === 401 && !error.config?.skipAuthSessionHandling) {
    removeToken()
    window.dispatchEvent(new Event('auth-session-expired'))
  }
  return Promise.reject(error)
})
