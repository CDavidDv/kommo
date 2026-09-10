# SALESBOT-SETUP.md — FASE 7-11

Kommo **no tiene API para crear/editar Salesbots**. El escenario se define en JSON
(en `config/bots/kommo/`) y se pega a mano en la UI. Este doc explica cómo.

## Cómo pegar un bot en Kommo

1. `Ajustes` → `Herramientas de comunicación` → `Salesbots` → **`Crear un bot nuevo`**.
2. Nómbralo (ver tabla abajo).
3. En el editor del bot, botón **`</>`** (o "Importar" / "código") para pegar JSON.
4. Pega el contenido del archivo `.json` correspondiente. **Validar**. Guardar.
5. Activar el bot.

## Bots y dónde se enganchan

| Bot | Archivo JSON | Se dispara en (Digital Pipeline) |
| --- | --- | --- |
| Monkits · Bienvenida y triaje | `config/bots/kommo/welcome.json` | P0 Recepción › **Sin clasificar** |
| Monkits · Flujo Público | (FASE 8) | P1 Público › Nuevo |
| Monkits · Flujo Mayoreo | (FASE 9) | P2 Mayoreo › Nuevo |
| Monkits · Flujo Distribuidor | (FASE 10) | P3 Distribuidor › Nuevo |
| Monkits · Flujo Franquicia | (FASE 11) | P4 Franquicia › Nuevo |

## FASE 7 — orden de trabajo

### 1. Bot mínimo de prueba (`welcome-test.json`)

Pega este primero. Solo manda un mensaje y cierra. Sirve para confirmar que:
- Kommo acepta el formato JSON que generamos.
- El bot guarda y activa sin error.

Si guarda OK → seguimos. Si da error de validación → me pasás el mensaje exacto.

### 2. Bot de bienvenida completo (`welcome.json`)

Reemplaza el JSON del bot de prueba por este. Qué hace:

```
al entrar el lead a P0 › Sin clasificar:
  + etiqueta NUEVO_LEAD + BOT_ATENDIENDO
  mueve a P0 › Esperando elección
  muestra: "Hola, gracias por contactar a Monkits..."  + 4 botones
  según el botón:
    - set Tipo de cliente (PUBLICO/MAYOREO/DISTRIBUIDOR/FRANQUICIA)
    - set Estado comercial = NUEVO
    - + etiqueta del tipo
    - mueve el lead a P1/P2/P3/P4 › Nuevo   (dispara el bot de ese flujo)
  al terminar: quita BOT_ATENDIENDO, cierra
```

### 3. Digital Pipeline (manual)

`Leads` → `Automatizar` → etapa **P0 · Sin clasificar** → `Añadir` → `Salesbot`
→ elegir "Monkits · Bienvenida y triaje".

Sin esto el bot existe pero nunca se lanza solo.

### 4. Prueba end-to-end (con tu OK)

Crear un lead de prueba en P0 · Sin clasificar (o mandar un mensaje por un canal ya
conectado). Verificar: mensaje inmediato → 4 botones → al elegir, el lead salta al
pipeline correcto con campo + etiqueta puestos.

## IDs usados en `welcome.json` (cuenta santilop357)

| Elemento | ID |
| --- | --- |
| Campo "Tipo de cliente" (MK_TIPO_CLIENTE) | `42150` |
| Campo "Estado comercial" (MK_ESTADO_COMERCIAL) | `42154` |
| P0 › Esperando elección | `111515115` |
| P1 Público › Nuevo | `111513623` |
| P2 Mayoreo › Nuevo | `111515127` |
| P3 Distribuidor › Nuevo | `111515155` |
| P4 Franquicia › Nuevo | `111515183` |

> Si se recrean los campos (p.ej. otro `--regroup-fields`), los IDs cambian →
> volver a correr `npm run audit` y ajustar el JSON.

## Dudas a confirmar en la prueba

- `set_custom_fields` sobre un campo **select**: probamos con el **texto** de la opción
  (`"value": "PUBLICO"`). Si Kommo no lo setea, hay que usar el **id del enum**
  (PUBLICO=32876, MAYOREO=32878, DISTRIBUIDOR=32880, FRANQUICIA=32882 · NUEVO=32900).
- `change_status` a una etapa de otro pipeline: debería mover el lead entre pipelines
  (el `status_id` es único global). Confirmar en la prueba.
