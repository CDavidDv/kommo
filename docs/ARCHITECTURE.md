# ARCHITECTURE.md

## Decisión FASE 4 (2026-09-10): 5 pipelines

Aprobado: arquitectura de **5 pipelines** + campo `TIPO_CLIENTE` + etiquetas de estado.
Se reutiliza el pipeline existente `Embudo de ventas` (id 14436983) como **P1 · Público**.

### Por qué 5 pipelines y no 1 ramificado ni 4

| Criterio | 1 ramificado | 4 pipelines | **5 pipelines** |
| --- | --- | --- | --- |
| Embudos de conversión por tipo | sin sentido (etapas no relacionadas) | limpios | limpios |
| Aislamiento de automatizaciones Digital Pipeline | malo | bueno | bueno |
| Default de responsable por rama | difícil | fácil | fácil |
| Métrica "1ª respuesta / % clasificados / leads recibidos" | difusa | difusa | **limpia (todo en P0)** |
| Board usable por vendedor | no | sí | sí |
| Nº de Salesbots | 1 welcome + 4 flujos | igual | igual |
| 5º tipo futuro | peor | nuevo pipeline | nuevo pipeline |

El nº de Salesbots es el mismo en las 3 opciones → "evitar duplicación de Salesbots" no favorece a ninguna.
El coste de 5 pipelines es que los dashboards agregados por tipo se filtran por `MK_TIPO_CLIENTE` (Kommo lo soporta).

### Los pipelines

```
P0 · Recepción & Triaje   (is_main, unsorted OFF)
   Sin clasificar → Esperando elección → Reenganche
   142 Clasificado y movido   ·   143 Descartado / Spam / inválido

P1 · Público   (reusa id 14436983, renombra etapas)
   Nuevo → Info enviada → Tienda enviada → En seguimiento → En conversación (humano) → Compra confirmada
   142 Ganado – compra   ·   143 Perdido

P2 · Mayoreo
   Nuevo → Calificando → Datos completos → Cotización solicitada → Cotización enviada → Negociación
   142 Ganado   ·   143 Perdido

P3 · Distribuidor
   Nuevo → Información inicial → Datos del negocio → Evaluación → Asesor asignado → Negociación
   142 Distribuidor activo   ·   143 Descartado

P4 · Franquicia
   Nuevo → Interés identificado → Datos recopilados → Presentación → Asesor especializado → Negociación
   142 Franquicia activa   ·   143 Descartado
```

### Routing de un lead

```
Canal (WhatsApp/IG/FB/TikTok/form/web)
  └─> P0 · Recepción › Sin clasificar        (unsorted OFF: lead entra directo)
        └─> Salesbot "Bienvenida y triaje" responde YA
              pregunta → cliente elige 1 de 4
              └─> set MK_TIPO_CLIENTE + etiqueta de tipo
              └─> mueve el lead a P1/P2/P3/P4 › Nuevo
                    └─> arranca el Salesbot de ese pipeline
```

Un lead vive en 1 pipeline+etapa. El welcome-bot hace el cambio de pipeline UNA vez.
`MK_TIPO_CLIENTE` queda como red de seguridad y para reporting cross-pipeline.

### Qué es código y qué es manual

| Capa | Cómo |
| --- | --- |
| Pipelines, etapas, grupos de campos, campos, etiquetas | **código** — `npm run install:monkits` (idempotente) |
| Escenarios de Salesbot (5) | **manual** — JSON en `config/bots/*.json`, se pega en la UI (FASE 7-11) |
| Digital Pipeline (lanzar bot al entrar a etapa, detener bot, tarea automática, asignar responsable) | **manual** — `docs/MANUAL-SETUP.md` |
| Conexión de canales sociales | **manual** — en Kommo + Meta/TikTok |
| Tareas de seguimiento puntuales | **código** — `POST /tasks` (usable desde un servicio que escuche webhooks, FASE 12) |

### Componentes de código

```
src/config/env.ts      credenciales desde .env (nunca las loguea)
src/config/load.ts     carga + valida config/*.json (paleta de colores, tipos de campo, unicidad)
src/kommo/client.ts    cliente HTTP: throttle ~3.8 req/s, retry 429/5xx, aborta si 403 tras 429
src/kommo/paginate.ts  collectAll — recorre colecciones paginadas
src/monkits/plan.ts    diff config vs cuenta real → lista de acciones
src/monkits/apply.ts   ejecuta el plan (nunca toca datos de leads/contactos)
src/scripts/verify.ts  FASE 1 — prueba de conexión read-only
src/scripts/audit.ts   FASE 2 — inventario read-only → docs/current-account.json
src/scripts/install.ts FASE 14 — dry-run / apply con confirmación
```

### Idempotencia

- Pipelines: match por `reuse.pipeline_id`, si no por nombre.
- Etapas: match por `reuse_status_id` / `system` (142/143) / nombre.
- Campos: match por `code` (uppercase), si no por nombre.
- Grupos y etiquetas: match por nombre. La API de tags además dedup por nombre server-side.
- Re-ejecutar el instalador no crea duplicados; solo aplica lo que falta.

### Riesgos conocidos

- Renombrar etapas de sistema 142/143 tiene `is_editable=false` en la cuenta actual → Kommo **puede rechazar** el PATCH. El instalador lo intenta y tolera el fallo (queda el nombre por defecto). No es bloqueante.
- Cambiar `is_main` de P0 y `is_unsorted_on` de P1 modifica el enrutado por defecto de leads nuevos → el instalador lo marca como cambio "risky" y pide confirmación.
- Campos de lead: 21 actuales + 13 nuevos = 34 / 40. Margen para ~6 más.
