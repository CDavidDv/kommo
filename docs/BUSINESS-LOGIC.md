# BUSINESS-LOGIC.md

Resumen operativo. Detalle completo en `CLAUDE.md` §5-19.

## Objetivo

`LEAD → RESPUESTA INMEDIATA → CLASIFICACIÓN → INFO → SEGUIMIENTO → ASESOR HUMANO CUANDO HAGA FALTA → VENTA`

Automatización **determinística** (sin IA generativa): el bot pregunta, ofrece opciones, clasifica, guarda datos, mueve, crea tareas, hace seguimiento, entrega a un humano.

## 4 tipos de cliente

| Tipo | Volumen | Objetivo del bot | Cuándo entra el humano |
| --- | --- | --- | --- |
| **Público** | ~1-5 kits | conversión rápida: info + link de tienda + seguimiento auto | duda compleja, pide persona, intención alta |
| **Mayoreo** | >5 kits | calificar (cantidad/uso/ubicación) + preparar cotización | siempre tras recopilar datos |
| **Distribuidor** | revende en sus tiendas | identificar negocio, canales, volumen | tras datos del negocio |
| **Franquicia** | modelo Monkits en escuelas + talleres | identificar interés, explicar concepto breve, recopilar datos | **rápido** — lead de alto valor |

El bot **nunca** negocia precio, descuentos, regalías, territorio, exclusividad ni condiciones legales.

## Clasificación

- Campo `MK_TIPO_CLIENTE` ∈ {PUBLICO, MAYOREO, DISTRIBUIDOR, FRANQUICIA} — lo pone el welcome-bot.
- Etiqueta equivalente (`PUBLICO`…`FRANQUICIA`) para filtrado rápido.
- Pipeline = tipo (P1-P4). El pipeline es la fuente de verdad operativa; el campo es para reporting y respaldo.

## Datos por tipo (campos de lead)

| Campo | Público | Mayoreo | Distribuidor | Franquicia |
| --- | :-: | :-: | :-: | :-: |
| MK_CANTIDAD_KITS | – | ✓ | ✓ | – |
| MK_NOMBRE_ORG | – | ✓ | ✓ | ✓ |
| MK_CIUDAD / MK_ESTADO_MX | – | ✓ | ✓ | ✓ |
| MK_TIPO_INSTITUCION | – | opc | ✓ | opc |
| MK_INTERES | opc | ✓ | ✓ | ✓ |
| MK_CANALES_VENTA | – | – | ✓ | – |
| MK_EXPERIENCIA_COMERCIAL | – | – | ✓ | ✓ |
| MK_INTERES_ESCUELAS / MK_INTERES_TALLERES | – | – | – | ✓ |
| MK_FUENTE_LEAD | ✓ | ✓ | ✓ | ✓ |
| MK_ESTADO_COMERCIAL | ✓ | ✓ | ✓ | ✓ |

Vendedor asignado = **responsable nativo** de Kommo (`responsible_user_id`), no un campo.

## Seguimiento (el corazón del proyecto)

Problema: leads que escriben, nadie contesta a tiempo, se enfrían, nadie da seguimiento.

Solución:
1. Respuesta automática inmediata (P0, unsorted OFF).
2. Registro + clasificación automáticos.
3. Tarea de seguimiento por cada lead que necesita humano (`POST /tasks`).
4. Mensajes de seguimiento espaciados (Digital Pipeline): máx 1 / 24h, máx 3, sin spam, respetando políticas del canal.
5. El bot se detiene cuando el operador responde.
6. Se registra el resultado (Ganado / Perdido + motivo).

## Métricas (FASE 18)

leads recibidos · tiempo a 1ª respuesta · % clasificados · % con seguimiento · cotizaciones · conversiones · valor de venta · conversión por canal (`MK_FUENTE_LEAD`) · conversión por tipo (`MK_TIPO_CLIENTE`) · **leads perdidos por falta de seguimiento**.

## Fuentes de lead

`MK_FUENTE_LEAD` ∈ {WHATSAPP, FACEBOOK, INSTAGRAM, TIKTOK, WEBSITE, FORMULARIO, REFERIDO, OTRO}.
Cuando el canal lo entrega (UTM / origen de chat), se rellena automáticamente; si no, lo pregunta el bot o lo pone el vendedor.

## Lo que NO queremos

Chatbot que responde cualquier cosa · IA inventando precios o condiciones · automatización agresiva · spam · CRM desde cero.
