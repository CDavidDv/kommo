# API-CAPABILITIES.md — Kommo API v4

FASE 0 — Investigación. Documento vivo. Nada se ha modificado en la cuenta de Kommo.

- **Base URL**: `https://<SUBDOMAIN>.kommo.com/api/v4/`
- **Auth**: `Authorization: Bearer <LONG_LIVED_TOKEN>` (HTTPS obligatorio)
- **Formato**: JSON / HAL+JSON (respuestas usan `_embedded`, `_links`, `_page`)
- **Doc oficial**: https://developers.kommo.com/  · índice: https://developers.kommo.com/llms.txt
- Cualquier página de docs acepta `.md` al final para versión markdown.

---

## 1. Tabla de capacidades

| Funcionalidad | API disponible | Endpoint / doc | Automatizable | Notas |
| --- | --- | --- | --- | --- |
| Consultar cuenta | Sí | `GET /account?with=amojo_id,users_groups,task_types,version` · [doc](https://developers.kommo.com/reference/account) | Sí | Devuelve `id`, `name`, `subdomain`, `created_at`, `currency`, `timezone`. Solo lectura por API. |
| Consultar usuarios | Sí | `GET /users?with=role,group` · [doc](https://developers.kommo.com/reference/users-list) | Sí (lectura) | Solo admin. Se usa para mapear `responsible_user_id` de vendedores. |
| Crear/activar/desactivar usuarios | Sí | `POST /users`, `/users/active`, `/users/inactive` | Sí | No necesario ahora. Requiere admin. |
| Roles de usuario | Sí | `GET/POST/PATCH/DELETE /roles` · [doc](https://developers.kommo.com/reference/user-roles-list) | Sí | Opcional (permisos por tipo de lead). |
| Consultar pipelines | Sí | `GET /leads/pipelines` · [doc](https://developers.kommo.com/reference/pipelines-list) | Sí | Base de la idempotencia (buscar antes de crear). |
| Crear/editar/borrar pipeline | Sí | `POST/PATCH/DELETE /leads/pipelines` · [doc](https://developers.kommo.com/reference/add-pipelines) | Sí | Campos: `name`, `sort`, `is_main`, `is_unsorted_on`. Etapas inline vía `_embedded.statuses`. Máx **50 pipelines/cuenta**. DELETE solo con aprobación explícita. |
| Consultar etapas | Sí | `GET /leads/pipelines/{id}/statuses` · [doc](https://developers.kommo.com/reference/stages-list) | Sí | |
| Crear/editar/borrar etapas | Sí | `POST/PATCH/DELETE /leads/pipelines/{id}/statuses` · [doc](https://developers.kommo.com/reference/add-stages) | Sí | Etapas de sistema: `142` Closed-Won, `143` Closed-Lost (renombrables, NO borrables). `1` = Incoming/Unsorted. Máx **100 etapas/pipeline**. `color` en hex. |
| Consultar campos personalizados | Sí | `GET /{leads\|contacts\|companies}/custom_fields` · [doc](https://developers.kommo.com/reference/custom-field-by-entity) | Sí | Buscar por `code`/`name` antes de crear. |
| Crear/editar/borrar campos | Sí | `POST/PATCH/DELETE /{entity}/custom_fields` · [doc](https://developers.kommo.com/reference/add-custom-fields) | Sí | 19 tipos (text, numeric, select, multiselect, date, date_time, url, textarea, radiobutton, checkbox, streetaddress, smart_address, birthday, legal_entity, monetary, tracking_data, ...). `enums` para select/multiselect/radiobutton. Máx **40 campos/entidad**. |
| Grupos de campos | Sí | `GET/POST/PATCH/DELETE /{entity}/custom_fields/groups` · [doc](https://developers.kommo.com/reference/list-of-entity-field-groups) | Sí | Para agrupar los campos de Monkits en la tarjeta del lead. |
| Consultar etiquetas | Sí | `GET /{leads\|contacts\|companies}/tags` · [doc](https://developers.kommo.com/reference/list-of-entity-tags) | Sí | |
| Crear etiquetas | Sí | `POST /{entity}/tags` · [doc](https://developers.kommo.com/reference/add-tags) | Sí | **Idempotente por diseño**: si el `name` ya existe, devuelve el id existente (no duplica). `color` opcional. |
| Asignar etiquetas a leads/contactos | Sí | `PATCH /{entity}` con `_embedded.tags` | Sí | |
| Leads (CRUD) | Sí | `GET/POST/PATCH /leads`, `/leads/{id}` · [doc](https://developers.kommo.com/reference/leads-list) | Sí | Alta compleja (lead+contacto+empresa) vía `POST /leads/complex`. No tocar leads reales sin aprobación. |
| Motivos de pérdida | Sí | `GET/POST /leads/loss_reasons` · [doc](https://developers.kommo.com/reference/loss-reasons) | Sí | Útil para métrica "leads perdidos por falta de seguimiento". |
| Contactos (CRUD) | Sí | `GET/POST/PATCH /contacts` · [doc](https://developers.kommo.com/reference/contacts-list) | Sí | |
| Empresas (CRUD) | Sí | `GET/POST/PATCH /companies` · [doc](https://developers.kommo.com/reference/companies-list) | Sí | Para escuela/negocio en mayoreo/distribuidor/franquicia. |
| Tareas | Sí | `POST /tasks` · [doc](https://developers.kommo.com/reference/add-tasks) | Sí | `text`, `complete_till` (unix, req.), `entity_id`, `entity_type`, `task_type_id`, `responsible_user_id`. Núcleo del seguimiento. |
| Tipos de tarea | Sí (lectura) | `GET /account?with=task_types` | Parcial | Los task types se leen; crearlos = MANUAL en Kommo. |
| Notas (comentarios en lead) | Sí | `GET/POST /{entity}/{id}/notes` | Sí | Para registrar contexto del bot. |
| Webhooks | Sí | `GET/POST/DELETE /webhooks` · [doc](https://developers.kommo.com/reference/add-webhooks) | Sí | Solo admin. Requiere plan **Advanced/Pro/Enterprise**. `destination` + `settings` (array de eventos, p.ej. `add_lead`, `status_lead`, `add_task`). Payload `x-www-form-urlencoded`, responder 2xx en <2s. |
| Eventos / catálogo de webhooks | Sí | [webhook-events](https://developers.kommo.com/reference/webhook-events) | — | 30+ eventos (add/update/delete/restore, cambio de estado, cambio de responsable, mensaje entrante, nota). |
| Listar Salesbots | Sí | `GET /api/v4/bots` (`?filter[type]=greeting\|regular\|marketing\|nps`) · [doc](https://developers.kommo.com/reference/salesbots-list) | Sí (lectura) | Sirve para verificar existencia (idempotencia). |
| Obtener Salesbot por ID | Sí | `GET /api/v4/bots/{id}` · [doc](https://developers.kommo.com/reference/get-salesbot-by-id) | Sí (lectura) | |
| Lanzar / detener Salesbot | Sí | `POST /api/v4/salesbot/run`, `/salesbot/{id}/disable` · [doc](https://developers.kommo.com/reference/launch-a-salesbot) | Sí | Dispara un bot YA existente sobre un lead. Útil desde webhook de lead nuevo. |
| **Crear / editar / borrar Salesbot** | **No** | — | **MANUAL_REQUIRED** | No hay endpoint público de creación/edición. El bot se diseña en la UI (Settings → Communication tools → Salesbots) pegando un **JSON de escenario**. Guardaremos ese JSON en `config/bots/*.json` y se pega a mano. |
| **Digital Pipeline (triggers, auto-acciones por etapa)** | **No** | — | **MANUAL_REQUIRED** | No hay API pública de escritura para automatizaciones del Digital Pipeline. Se configura en Leads → Automatizar. La API solo puede *lanzar* un salesbot, no *engancharlo* a una etapa. |
| Conectar WhatsApp / Facebook / Instagram / TikTok | **No** | — | **MANUAL_REQUIRED** | Autorización OAuth de cada canal se hace en la UI de Kommo + la plataforma. La *Chats API* existe pero es para **construir un canal propio**, no para conectar cuentas de Meta/TikTok. |
| Chats API (mensajería) | Sí (parcial) | [chats](https://developers.kommo.com/docs/chat-api-basics) | Parcial | Dominio `amojo`. Solo si Monkits quiere un canal custom (ej. web widget propio). Fuera de alcance inicial. |
| Cambiar moneda / zona horaria / plan de la cuenta | No | — | MANUAL_REQUIRED | Solo lectura por API. |
| Importar leads masivo | Parcial | `POST /leads` en lotes | Sí | Lote recomendado ≤50. |

---

## 2. Autenticación

- **Long-lived token** (integración privada): sin `refresh_token`, con **derechos de administrador** de la cuenta.
  Crear en: integración privada → pestaña **Keys and scopes** → *Generate long-lived token* → elegir expiración (1 día a 5 años).
- Header: `Authorization: Bearer <token>`.
- El token **no se puede volver a ver** tras generarlo. Si se pierde → regenerar.
- Revocar/monitorear en pestaña **Authorization** de la integración.
- Token actual (de `claves.txt`): scopes `crm`, `files`, `files_delete`, `notifications`, `push_notifications`, `list_external_messages`, `send_external_messages`. **Expira ~2026-10-29** (vida ~50 días — corta, habrá que regenerar con más margen). `account_id` 36953847, subdominio `santilop357`.
  - ⚠️ El scope `crm` cubre pipelines/campos/etiquetas/leads/tareas. Webhooks requieren admin (el long-lived token lo es) **y** plan Advanced+ — **a verificar en FASE 1**.

## 3. Límites y manejo de errores

| Límite | Valor |
| --- | --- |
| Rate limit | **7 req/s** → HTTP **429** |
| Abuso / 429 repetido | Bloqueo por IP → HTTP **403** en todas las requests |
| GET por página | ≤ 250 entidades |
| POST/PATCH por request | ≤ 250 (recomendado **≤ 50**); exceso → HTTP 504 |
| Campos personalizados | 40 por entidad |
| Pipelines | 50 por cuenta |
| Etapas | 100 por pipeline (incluye sistema) |
| Webhooks | 100 por cuenta |
| Listas (Lists) | 10 por cuenta |

**Estrategia cliente (FASE 1):**
- Limitar a ~4 req/s (margen bajo 7).
- En 429: leer `Retry-After` si viene; si no, backoff exponencial (1s, 2s, 4s, 8s) con jitter, máx ~5 reintentos.
- En 403 tras 429: abortar y avisar (posible bloqueo IP), no seguir martillando.
- Nunca loguear el token ni headers `Authorization`.
- Códigos: 400 datos inválidos · 401 token malo/expirado · 403 permisos/plan · 422 no procesable · 429 rate · 5xx reintentar.

Docs: [limitations](https://developers.kommo.com/docs/limitations) · [http-codes](https://developers.kommo.com/docs/http-codes)

## 4. Qué NO se puede automatizar (MANUAL_REQUIRED)

1. **Crear/editar Salesbots** — diseño JSON pegado en UI. Versionamos el JSON en `config/bots/`.
2. **Digital Pipeline** — triggers y auto-acciones por etapa (incluye "al entrar a etapa X, lanzar bot Y", "crear tarea automática", "enviar mensaje"). Se configura a mano; documentar en `docs/MANUAL-SETUP.md`.
3. **Conexión de canales** WhatsApp / Facebook / Instagram / TikTok / formularios web nativos.
4. **Tipos de tarea** personalizados.
5. **Ajustes de cuenta**: moneda, zona horaria, plan.
6. **Bandeja de entrada unificada / reglas de "el humano toma control"** — depende de config de canal + Digital Pipeline.

> Regla: lo MANUAL se documenta paso a paso en `docs/MANUAL-SETUP.md` (FASE 13/16). No se hace scraping ni endpoints internos.

## 5. Arquitectura que esto implica

- **Automatizable por código**: pipelines, etapas, campos, grupos de campos, etiquetas, motivos de pérdida, tareas, notas, webhooks, lanzar bots, inventario/auditoría.
- **Semi-automatizable**: Salesbots (JSON en repo → pegar en UI).
- **100% manual**: Digital Pipeline, canales sociales.
- El "seguimiento automático" (FASE 12) se reparte:
  - Tareas de seguimiento → API (`POST /tasks`). ✅
  - Mensajes de seguimiento automáticos y "parar bot cuando entra humano" → Digital Pipeline / Salesbot = MANUAL.
  - Alternativa 100% código: servicio propio que escucha webhooks (`add_lead`, `status_lead`) y llama a la API (crear tarea, lanzar bot, mover etapa). Requiere hosting. A decidir en FASE 3.

## 6. `npx @kommo-crm/create-kommo-integration`

**No se necesita.** Ese paquete hace *scaffold de un widget de UI* (frontend, `manifest.json`, locales) para incrustar dentro de Kommo. Este proyecto es un configurador server-side contra la API REST v4 — stack propio TypeScript + fetch. No hay widget.
