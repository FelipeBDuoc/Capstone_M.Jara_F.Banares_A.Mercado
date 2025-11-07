/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DISCORD_CLIENT_ID: string;
  readonly DISCORD_CLIENT_SECRET: string;
  readonly DISCORD_BOT_TOKEN: string;
  readonly MI_SERVIDOR_ID: string;
  readonly ID_ROL_ADMIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
