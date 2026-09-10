# kommo-monkits

Configurador idempotente del CRM comercial de Monkits sobre **Kommo** (API oficial v4).
No es un CRM nuevo: automatiza la creación/config de pipelines, etapas, campos, etiquetas,
tareas y webhooks. Salesbots y Digital Pipeline se documentan como pasos manuales.

## Estado

- [x] FASE 0 — Investigación API → `docs/API-CAPABILITIES.md`
- [x] FASE 1 — Cliente (`src/kommo/`) + `npm run verify` (conexión OK, 14 tests verdes)
- [x] FASE 2 — `npm run audit` → `docs/current-account.json` + `.md` (gitignored)
- [x] FASE 3 — config declarativa: `config/pipelines.json`, `fields.json`, `tags.json`, `bots/*.json`, `automations.json`
- [x] FASE 4 — arquitectura aprobada: **5 pipelines** (`docs/ARCHITECTURE.md`)
- [x] FASE 14 (parcial) — `npm run install:monkits -- --dry-run` funcionando
- [ ] Aplicar: `npm run install:monkits -- --apply`  (pendiente tu OK)
- [ ] FASE 7-11 — escenarios Salesbot · FASE 12-13 — Digital Pipeline + canales (manual)

## Requisitos

- Node ≥ 20
- Integración privada en Kommo con **long-lived token**

## Setup

```bash
npm install
cp .env.example .env   # rellenar KOMMO_SUBDOMAIN y KOMMO_LONG_LIVED_TOKEN
```

Variables (ver `.env.example`):

| Var | Uso |
| --- | --- |
| `KOMMO_SUBDOMAIN` | subdominio sin `.kommo.com` |
| `KOMMO_LONG_LIVED_TOKEN` | token de larga duración (secreto) |
| `KOMMO_CLIENT_SECRET` / `KOMMO_INTEGRATION_ID` | solo para JWT de Salesbot/widget (opcional) |
| `MONKITS_STORE_URL` / `MONKITS_WEBSITE_URL` | URLs comerciales (FASE 8+) |

## Comandos (a implementar)

| Comando | Qué hace | Modifica Kommo |
| --- | --- | --- |
| `npm run verify` | prueba de conexión de solo lectura | No |
| `npm run audit` | inventario → `docs/current-account.json` | No |
| `npm run install:monkits -- --dry-run` | plan detallado, sin cambios (default) | No |
| `npm run install:monkits -- --apply` | aplica config (pide confirmación) | Sí |
| `npm run install:monkits -- --apply --yes` | aplica sin preguntar | Sí |
| `npm test` | pruebas | No |

## Docs

| Archivo | Contenido |
| --- | --- |
| `docs/API-CAPABILITIES.md` | qué permite la API v4, límites, qué es manual |
| `docs/ARCHITECTURE.md` | decisión de 5 pipelines, routing, componentes de código |
| `docs/BUSINESS-LOGIC.md` | tipos de cliente, campos por tipo, seguimiento, métricas |
| `docs/MANUAL-SETUP.md` | pasos en Kommo/Meta/TikTok tras el instalador |
| `docs/current-account.{json,md}` | inventario read-only (gitignored) |

## Manual (no cubierto por API)

Salesbots, Digital Pipeline, conexión WhatsApp/Meta/TikTok → `docs/MANUAL-SETUP.md`.

## Seguridad

`.env` y `claves.txt` están en `.gitignore`. Nunca commitear secretos.
El repo aún no está en git.
