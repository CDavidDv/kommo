# SALESBOT-SETUP.md — FASE 7-12

Kommo **no tiene API para crear/editar Salesbots**. El escenario se pega a mano en la UI.

## Flujo

1. **`npm run install:monkits -- --apply`** — crea pipelines / etapas / campos / etiquetas.
2. **`npm run bots:compile`** — lee la cuenta viva + `config/bots/templates/*.json` y
   escribe el JSON listo para pegar en `config/bots/kommo/*.json` (con los IDs reales).
3. Pegar cada `config/bots/kommo/*.json` en su Salesbot en Kommo.
4. Enganchar cada bot a su etapa en el Digital Pipeline (manual).

> Migrar a otra cuenta = repetir 1-2 con el `.env` nuevo. Las plantillas usan
> referencias simbólicas (`@stage:talleres/interesado`, `@field:MK_TIPO_CLIENTE`),
> nunca IDs; el compilador los resuelve contra la cuenta destino.

## Cómo pegar un bot en Kommo

1. `Ajustes` → `Herramientas de comunicación` → `Salesbots` → **`Crear un bot nuevo`**.
2. Nómbralo (tabla abajo).
3. Editor del bot → botón **`</>`** (código) → pegar el JSON → **Validar** → Guardar → Activar.

## Bots

| Bot | Plantilla | Se dispara en |
| --- | --- | --- |
| Monkits · Bienvenida y triaje | `templates/welcome.json` | P0 Recepción › **Sin clasificar** |
| Monkits · Flujo Público | `templates/public.json` (FASE 8) | P1 Público › Nuevo |
| Monkits · Flujo Mayoreo | `templates/wholesale.json` (FASE 9) | P2 Mayoreo › Nuevo |
| Monkits · Flujo Distribuidor | `templates/distributor.json` (FASE 10) | P3 Distribuidor › Nuevo |
| Monkits · Flujo Franquicia | `templates/franchise.json` (FASE 11) | P4 Franquicia › Nuevo |
| Monkits · Flujo Talleres | `templates/talleres.json` (FASE 8b) | P5 Talleres › Interesado |

## FASE 7 — bienvenida, orden de trabajo

### 1. Bot mínimo de prueba (`config/bots/kommo/welcome-test.json`)

Solo manda un mensaje y cierra. Confirma que Kommo acepta nuestro formato y que el
bot guarda/activa sin error. Si falla → pasame el mensaje exacto.

### 2. Bot de bienvenida completo (`config/bots/kommo/welcome.json`)

```
al entrar el lead a P0 › Sin clasificar:
  + etiqueta NUEVO_LEAD + BOT_ATENDIENDO
  mueve a P0 › Esperando elección
  muestra saludo + 5 botones
  según botón:
    - set Tipo de cliente (PUBLICO/MAYOREO/DISTRIBUIDOR/FRANQUICIA/TALLER)
    - set Estado comercial = NUEVO
    - + etiqueta del tipo
    - mueve el lead a P1/P2/P3/P4/P5 › (primera etapa)   → dispara el bot de ese flujo
  al terminar: quita BOT_ATENDIENDO, cierra
```

### 3. Digital Pipeline (manual)

`Leads` → `Automatizar` → **P0 · Sin clasificar** → `Añadir` → `Salesbot` →
"Monkits · Bienvenida y triaje". Sin esto el bot nunca se lanza solo.

### 4. Prueba end-to-end (con tu OK)

Lead de prueba en P0 · Sin clasificar → verificar: mensaje inmediato → 5 botones →
al elegir, el lead salta al pipeline correcto con campo + etiqueta puestos.

## FASE 8-11 — bots de flujo

Cada bot: recopila datos → pone campos/etiquetas → mueve el lead a una etapa de
"datos recopilados" → **para**. Todo con handlers **documentados** de Kommo
(`show`, `buttons`, `action`, `preset`, `stop`). Textos de negocio ya incluidos
(tienda `monkits.com`, horario L-V 10-18 / Sáb 10-14, pagos por transferencia).

| Plantilla | Recopila | Mueve a |
| --- | --- | --- |
| `public.json` | (nada — manda link de tienda) | P1 › Tienda enviada / En seguimiento / En conversación |
| `wholesale.json` | cantidad, uso, ciudad, org, tel+email | P2 › Datos completos |
| `distributor.json` | negocio, tipo, ciudad, canales, volumen, experiencia, tel+email | P3 › Datos del negocio |
| `franchise.json` | org, ciudad, interés escuelas/talleres, experiencia, tel+email | P4 › Datos recopilados |
| `talleres.json` | taller+fechas+edades, nº participantes, tel+email | P5 › Datos de inscripción |

**Lo que los bots NO hacen** (no está en la API documentada de Salesbot):
- **Crear tareas** → lo hace el **Digital Pipeline** al entrar a la etapa de "datos"
  (ver `config/automations.json` / `docs/MANUAL-SETUP.md §B`).
- **Seguimientos con retraso (24h / 72h)** → Digital Pipeline ("tras N tiempo en etapa").
- **Asignar responsable** → Digital Pipeline (hoy 1 solo vendedor).
- **Parar el bot cuando responde un humano** → ajuste del propio bot en la UI
  ("pausar cuando el operador escribe").

## Dudas a confirmar en la prueba

- `set_custom_fields` en campo **select**: probamos con el **texto** de la opción
  (`"value": "PUBLICO"`). Si no lo setea → usar el **id del enum** (recompilar con
  esa variante).
- `set_custom_fields` en campo **texto/número**: usamos `"value": "{{message}}"` para
  guardar la última respuesta del cliente. Si Kommo usa otra variable, la ajustamos.
- `change_status` a una etapa de otro pipeline: debería mover el lead entre pipelines
  (`status_id` es único global). Confirmar.
- `preset: contacts.validate_base_info`: pide y valida teléfono + email del contacto.

## WhatsApp API oficial — ventana de 24h

Fuera de las 24h desde el último mensaje del cliente, WhatsApp **solo** permite enviar
**plantillas aprobadas en Meta**. Los seguimientos automáticos a >24h (Digital Pipeline)
necesitan una plantilla de WhatsApp aprobada. **MANUAL_REQUIRED** en Meta Business +
Kommo. Los mensajes del bot dentro de la conversación activa no tienen este límite.

## Datos de contacto (nombre / teléfono)

- WhatsApp entrega nombre + teléfono automáticamente.
- Instagram / Facebook / TikTok: solo nombre/usuario → los bots de flujo que pasan a
  humano (mayoreo, distribuidor, franquicia, talleres) piden teléfono/email con el
  handler `preset: contacts.validate_base_info` antes de crear la tarea.
