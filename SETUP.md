# GalgoAI — puesta en marcha (≈20 min)

Frontend: GitHub Pages → https://ithzk.github.io/GalgoIA/
Backend: Supabase (Postgres + Edge Function `api`) + OpenAI

## 1. Supabase
1. Crea un proyecto en https://supabase.com (plan gratis). Anota el **Project ref** (está en la URL del dashboard).
2. Dashboard → **SQL Editor** → pega y ejecuta `supabase/migrations/20260927000000_init.sql`.
3. Instala el CLI (`npm i -g supabase`) y en la raíz del repo:
   ```bash
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   ```

## 2. Google OAuth
1. https://console.cloud.google.com → APIs y servicios → **Credenciales** → Crear **ID de cliente OAuth** → tipo **Aplicación web**.
2. **Orígenes autorizados de JavaScript**: `https://ithzk.github.io` y `http://localhost:3000`. (No hace falta URI de redireccionamiento.)
3. Pantalla de consentimiento: **Interno** si tu cuenta es de Workspace del ITT; si no, **Externo** y publícala (el backend igual solo deja pasar `@tectijuana.edu.mx`).
4. Copia el **Client ID**.

## 3. Secretos y despliegue de la función
```bash
supabase secrets set \
  GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  OPENAI_API_KEY="sk-..." \
  ALLOWED_ORIGINS="https://ithzk.github.io,http://localhost:3000"

supabase functions deploy api --no-verify-jwt
```
Prueba: `curl https://TU_PROJECT_REF.supabase.co/functions/v1/api/health` → `{"ok":true}`.
(Opcional: `OPENAI_MODEL` — por defecto `gpt-4o-mini`.)

## 4. Documentos oficiales
Pon los documentos del ITT en `knowledge/` (ver `knowledge/README.md`) y ejecuta:
```bash
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \   # Dashboard → Settings → API (¡secreta, nunca al repo!)
node scripts/ingest.mjs
```

## 5. GitHub Pages
1. Repo → Settings → **Pages** → Source: **GitHub Actions**.
2. Repo → Settings → Secrets and variables → Actions → pestaña **Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://TU_PROJECT_REF.supabase.co/functions/v1/api`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = el Client ID
3. `git push` a `main` → el workflow publica el sitio.

## Desarrollo local
```bash
cd galgoai-web && cp .env.example .env.local   # llena los valores
npm install && npm run dev
```

## Seguridad (lo que ya quedó resuelto)
- Las tablas tienen RLS sin políticas: la anon key no lee nada; solo la función accede.
- El correo se toma del token de sesión firmado, no de lo que envía el navegador (nadie puede leer el historial de otro).
- Dominio `@tectijuana.edu.mx` validado en el servidor; la llave de OpenAI nunca sale del servidor.
- Límite de 12 mensajes/minuto por usuario.

## Pendiente (etapa 2)
Recordatorios, calificación de respuestas, tablón de anuncios y enlaces de contacto.
