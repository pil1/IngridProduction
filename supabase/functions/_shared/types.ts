// Type definitions for Supabase Edge Functions
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

export interface Request {
  method: string;
  headers: Headers;
  json(): Promise<any>;
}

export interface Response {
  constructor(body?: BodyInit | null, init?: ResponseInit): Response;
}