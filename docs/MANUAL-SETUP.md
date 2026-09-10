# MANUAL-SETUP.md

Todo lo que **NO** puede hacer el código (no hay API oficial de escritura).
Hacer estos pasos en la interfaz de Kommo / Meta / TikTok **después** de `npm run install:monkits`.

---

## A. Salesbots (Kommo UI)

Kommo no tiene API de creación de Salesbots. El escenario se define en JSON y se pega a mano.

1. `Ajustes` → `Herramientas de comunicación` → `Salesbots` → `Crear un bot nuevo o importar`.
2. Para cada bot, usar la especificación en `config/bots/` (el JSON de escenario Kommo se genera en FASE 7-11):

| Bot | Archivo | Se engancha a |
| --- | --- | --- |
| Monkits · Bienvenida y triaje | `config/bots/welcome.json` | P0 · Recepción › Sin clasificar |
| Monkits · Flujo Público | `config/bots/public.json` | P1 · Público › Nuevo |
| Monkits · Flujo Mayoreo | `config/bots/wholesale.json` | P2 · Mayoreo › Nuevo |
| Monkits · Flujo Distribuidor | `config/bots/distributor.json` | P3 · Distribuidor › Nuevo |
| Monkits · Flujo Franquicia | `config/bots/franchise.json` | P4 · Franquicia › Nuevo |

3. En cada bot: activar **"pausar el bot cuando un operador responde"** (para "el humano toma el control").

---

## B. Digital Pipeline (Kommo UI)

`Leads` → `Automatizar` → seleccionar etapa → `Añadir`.
Fuente de verdad: `config/automations.json`.

| Pipeline › Etapa | Automatización |
| --- | --- |
| Recepción › Sin clasificar | Lanzar Salesbot "Bienvenida y triaje" |
| Recepción › Reenganche | Crear tarea "Revisar lead sin clasificar" (+24h) |
| Público › Nuevo | Lanzar Salesbot "Flujo Público" |
| Público › En conversación (humano) | Detener todos los Salesbots · Notificar al responsable |
| Mayoreo › Nuevo | Lanzar Salesbot "Flujo Mayoreo" |
| Mayoreo › Datos completos | Detener Salesbots · Tarea "Preparar cotización" (+4h) · Asignar responsable |
| Distribuidor › Nuevo | Lanzar Salesbot "Flujo Distribuidor" |
| Distribuidor › Asesor asignado | Detener Salesbots · Tarea de evaluación · Asignar responsable |
| Franquicia › Nuevo | Lanzar Salesbot "Flujo Franquicia" |
| Franquicia › Datos recopilados | Detener Salesbots · Tarea "Contactar hoy" (+2h) · Asignar asesor |

Reglas globales:
- Al mover a etapa **Ganado**: etiqueta `VENTA`, `MK_ESTADO_COMERCIAL = GANADO`.
- Al mover a **Perdido/Descartado**: quitar etiquetas de bot, pedir motivo de pérdida.
- Seguimientos: máximo 1 mensaje automático / 24h, máx 3 reintentos, respetar la ventana de 24h de WhatsApp.

---

## C. Canales (Kommo UI + plataforma)

El código **no** conecta cuentas de Meta/TikTok. La API `Chats` de Kommo es para construir un canal propio, no para autorizar Meta.

1. `Ajustes` → `Integraciones` → conectar:
   - WhatsApp (WhatsApp Lite / API oficial / proveedor)
   - Facebook (páginas + Messenger)
   - Instagram (cuenta profesional vinculada a la página de FB)
   - TikTok (si hay integración disponible; si no → formulario/enlace)
2. Formularios / web: crear formulario Kommo o webhook de entrada.
3. **Importante:** en cada canal, configurar que los leads nuevos entren en el pipeline **`P0 · Recepción & Triaje`**, etapa `Sin clasificar`.
4. Verificar que `is_unsorted_on = false` en P0 (lo hace el instalador) para que el Salesbot responda de inmediato sin pasar por "Leads entrantes / sin organizar".

---

## D. Ajustes de cuenta (Kommo UI)

Solo lectura por API — revisar a mano:
- Moneda: MXN (ya配置). Zona horaria: verificar que sea la de México.
- Tipos de tarea: existen "Follow-up" y "Meeting". Añadir "Cotización" / "Llamada" si se quiere.
- Usuarios: hoy solo Santiago Lopez. Al sumar vendedores, definir reparto (round-robin / por pipeline) en Digital Pipeline.

---

## E. Token

El long-lived token actual **expira 2026-10-31**. Antes de esa fecha: integración privada → `Claves y permisos` → generar uno nuevo (hasta 5 años) y actualizar `.env`.
