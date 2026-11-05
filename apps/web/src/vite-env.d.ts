/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CAMPAIGN_GENERATION_MODE?: "simulation" | "openai";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
