/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // AI Provider
  readonly VITE_AI_PROVIDER: 'google' | 'openai';
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_AI_BASE_URL: string;

  // AI Models
  readonly VITE_AI_TEXT_MODEL: string;
  readonly VITE_AI_IMAGE_MODEL: string;

  // Generation Config
  readonly VITE_AI_TEMPERATURE: string;
  readonly VITE_AI_TOP_P: string;
  readonly VITE_AI_TOP_K: string;
  readonly VITE_AI_MAX_OUTPUT_TOKENS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
