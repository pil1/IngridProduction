// INFOtrac API Client - Replaces Supabase
import { apiClient } from '@/integrations/api/client';

// For backward compatibility, we export the API client as 'supabase'
export const supabase = apiClient;

// Expose api client globally for console access
declare global {
  interface Window {
    supabase: typeof apiClient;
    apiClient: typeof apiClient;
  }
}
window.supabase = apiClient;
window.apiClient = apiClient;

// Legacy environment variable checks (now optional)
const API_URL = import.meta.env.VITE_API_URL;
if (API_URL) {
  console.log('Using API URL:', API_URL);
} else {
  console.log('Using default API URL: http://localhost:3001/api');
}