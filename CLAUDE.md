# Monkits CRM — Contexto del proyecto

## 1. Objetivo general

Este proyecto busca configurar y automatizar el CRM comercial de Monkits utilizando Kommo como plataforma base.

NO estamos desarrollando un CRM desde cero.

Kommo será responsable de:

* recibir y centralizar leads;
* gestionar conversaciones cuando las integraciones estén conectadas;
* almacenar contactos;
* gestionar pipelines;
* gestionar etapas;
* registrar actividades;
* automatizar respuestas estructuradas;
* crear tareas;
* recordar seguimientos;
* permitir que vendedores humanos tomen control;
* mantener el historial comercial.

Nuestro código debe encargarse principalmente de automatizar la configuración de Kommo mediante su API oficial.

---

# 2. Problema que queremos resolver

Actualmente Monkits recibe personas interesadas a través de redes sociales y otros canales.

El problema principal NO es que falten personas interesadas.

El problema es el seguimiento comercial.

Actualmente puede ocurrir:

1. una persona manda mensaje;
2. nadie responde inmediatamente;
3. la persona pierde interés;
4. posteriormente alguien responde;
5. el vendedor no da seguimiento;
6. la persona termina olvidándose de comprar.

Queremos convertir este proceso en un sistema organizado.

Objetivo:

LEAD
→ RESPUESTA INMEDIATA
→ CLASIFICACIÓN
→ INFORMACIÓN
→ SEGUIMIENTO
→ ASESOR HUMANO CUANDO SEA NECESARIO
→ VENTA

---

# 3. Principio comercial

No queremos utilizar IA generativa para improvisar conversaciones comerciales.

Queremos automatización determinística.

Las respuestas iniciales deben estar previamente diseñadas y ser consistentes.

El bot debe:

* preguntar;
* ofrecer opciones;
* clasificar;
* guardar información;
* mover al cliente;
* crear tareas;
* hacer seguimiento;
* entregar el lead a un humano.

La IA de Kommo NO es un requisito para el sistema inicial.

No pagar una suscripción adicional de IA únicamente para resolver flujos que pueden implementarse mediante reglas.

---

# 4. Canales objetivo

El CRM debe estar preparado para recibir leads provenientes de:

* WhatsApp
* Facebook
* Instagram
* TikTok
* formularios
* sitio web
* otras fuentes posteriormente

La autorización/conexión de cada plataforma puede requerir configuración manual en Kommo o en la plataforma correspondiente.

NO asumir que el código debe encargarse de conectar cuentas de Meta/TikTok.

---

# 5. Tipos de clientes

Monkits tiene cuatro grandes categorías comerciales:

## 5.1 Público

Cliente que quiere comprar aproximadamente 1 a 5 kits.

Características:

* compra pequeña;
* normalmente no necesita negociación personalizada;
* el objetivo principal es llevarlo a la tienda/página;
* debe recibir información rápidamente;
* el seguimiento puede ser automatizado;
* el vendedor no debería dedicar demasiado tiempo salvo que exista una duda o necesidad específica.

Flujo:

NUEVO
→ IDENTIFICADO COMO PÚBLICO
→ INFORMACIÓN ENVIADA
→ TIENDA ENVIADA
→ SEGUIMIENTO
→ COMPRA / CIERRE

El bot debe intentar facilitar una compra rápida.

---

# 6. Mayoreo

Mayoreo corresponde aproximadamente a clientes que quieren comprar más de 5 kits.

Características:

* mayor valor potencial;
* requiere información sobre cantidad;
* puede necesitar cotización;
* atención más personalizada;
* requiere intervención de un vendedor.

Información que puede ser útil:

* nombre;
* cantidad aproximada;
* ciudad/estado;
* escuela/empresa/negocio;
* uso de los kits;
* datos de contacto;
* necesidades específicas.

Flujo:

NUEVO
→ MAYOREO
→ CALIFICACIÓN
→ DATOS RECOPILADOS
→ COTIZACIÓN
→ SEGUIMIENTO
→ NEGOCIACIÓN
→ VENTA

El bot NO debe intentar negociar precios especiales por sí mismo.

Debe preparar el lead para el vendedor.

---

# 7. Distribuidor

Un distribuidor es una persona o negocio que quiere comprar productos Monkits para venderlos posteriormente en sus propias tiendas físicas o canales comerciales.

No debe confundirse con una franquicia.

El distribuidor quiere comercializar productos.

Puede requerir:

* precio preferente;
* condiciones de distribución;
* cantidades;
* información comercial;
* datos del negocio.

Información a recopilar:

* nombre;
* negocio;
* ubicación;
* tipo de negocio;
* canales de venta;
* cantidad aproximada;
* experiencia comercial cuando sea relevante;
* interés en distribución.

Flujo:

NUEVO
→ DISTRIBUIDOR
→ INFORMACIÓN INICIAL
→ DATOS DEL NEGOCIO
→ EVALUACIÓN
→ ASESOR
→ NEGOCIACIÓN
→ DISTRIBUIDOR ACTIVO

---

# 8. Franquicia

Franquicia es un concepto diferente a distribución.

Una persona interesada en franquicia está interesada en utilizar el concepto/modelo Monkits para llevar productos y talleres de robótica directamente a escuelas.

Puede tratarse de:

* una persona;
* una organización;
* un negocio;
* alguien interesado en emprender;
* alguien interesado en vender productos y talleres a escuelas.

El objetivo es desarrollar un modelo comercial en el que pueda trabajar bajo el concepto/nombre de Monkits según las condiciones comerciales que la empresa defina.

Este es un lead de alto valor.

El bot debe:

* identificar el interés;
* explicar brevemente el concepto;
* recopilar información;
* generar una tarea;
* entregar rápidamente el lead a un asesor humano.

NO negociar automáticamente:

* precio;
* regalías;
* territorio;
* contratos;
* exclusividad;
* condiciones legales;
* condiciones de franquicia.

Flujo:

NUEVO
→ FRANQUICIA
→ INFORMACIÓN INICIAL
→ DATOS
→ INTERÉS CONFIRMADO
→ PRESENTACIÓN
→ ASESOR
→ NEGOCIACIÓN
→ FRANQUICIA ACTIVA

---

# 9. Primer contacto

Cuando un lead nuevo llegue y sea posible responder automáticamente, el sistema debe intentar contestar inmediatamente.

Ejemplo conceptual:

"Hola, gracias por contactar a Monkits. Para ayudarte mejor, ¿qué estás buscando?"

Opciones:

1. Comprar kits
2. Comprar por mayoreo
3. Distribuir Monkits
4. Llevar Monkits a escuelas

La redacción final debe poder modificarse desde configuración.

No hardcodear mensajes si pueden mantenerse como configuración.

---

# 10. Principio de clasificación

El CRM debe conocer el tipo de cliente.

Campo:

TIPO_CLIENTE

Valores:

* PUBLICO
* MAYOREO
* DISTRIBUIDOR
* FRANQUICIA

También pueden utilizarse etiquetas equivalentes.

Evitar duplicar información innecesariamente.

---

# 11. Objetivo del seguimiento

El seguimiento es una de las funciones más importantes del sistema.

El sistema debe evitar que un lead desaparezca después del primer mensaje.

Ejemplo:

Cliente:
"¿Cuánto cuesta?"

Sistema:
responde inmediatamente.

Después:

* registra lead;
* clasifica;
* guarda información;
* envía enlace;
* programa seguimiento.

Si no compra o no responde, puede existir otro contacto posterior.

Los seguimientos deben ser:

* útiles;
* breves;
* no agresivos;
* relevantes;
* espaciados;
* respetuosos de las políticas del canal.

Nunca hacer spam.

---

# 12. Cuándo debe intervenir un humano

El bot debe entregar el lead a una persona cuando:

* es mayoreo;
* es distribuidor;
* es franquicia;
* requiere cotización;
* requiere negociación;
* pregunta algo fuera del flujo;
* existe una duda compleja;
* el cliente solicita hablar con una persona;
* existe intención de compra alta;
* el flujo automático ya no es suficiente.

Cuando el humano toma control, evitar que el bot continúe enviando respuestas automáticas que interfieran con la conversación.

---

# 13. Público: estrategia comercial

Para público:

OBJETIVO PRINCIPAL = CONVERSIÓN RÁPIDA

No sobrecargar al cliente con preguntas.

Prioridad:

1. identificar que quiere compra individual;
2. proporcionar información;
3. dirigir a tienda;
4. resolver dudas básicas;
5. hacer seguimiento;
6. registrar venta.

---

# 14. Mayoreo: estrategia comercial

OBJETIVO PRINCIPAL = CALIFICAR Y GENERAR COTIZACIÓN

Prioridad:

1. cantidad;
2. ubicación;
3. uso;
4. datos del cliente;
5. información necesaria para cotizar;
6. vendedor;
7. seguimiento;
8. venta.

---

# 15. Distribuidor: estrategia comercial

OBJETIVO PRINCIPAL = IDENTIFICAR SOCIOS COMERCIALES POTENCIALES

Prioridad:

1. identificar negocio;
2. ubicación;
3. canales de venta;
4. interés;
5. cantidad;
6. vendedor;
7. evaluación;
8. negociación.

---

# 16. Franquicia: estrategia comercial

OBJETIVO PRINCIPAL = IDENTIFICAR OPORTUNIDADES DE ALTO VALOR

Prioridad:

1. identificar persona/organización;
2. entender interés;
3. ubicación;
4. experiencia o contexto relevante;
5. interés en escuelas;
6. interés en talleres;
7. vendedor especializado;
8. presentación;
9. negociación.

---

# 17. Filosofía del CRM

El CRM debe reducir trabajo humano repetitivo.

NO reemplazar a los vendedores.

La automatización debe encargarse de:

* responder rápido;
* clasificar;
* recopilar información;
* recordar;
* organizar;
* dar seguimiento.

Los humanos deben encargarse de:

* negociación;
* cotizaciones complejas;
* relaciones comerciales;
* distribuidores;
* franquicias;
* clientes importantes;
* problemas especiales.

---

# 18. Métrica principal

No medir el éxito solamente por cantidad de mensajes.

Las métricas importantes son:

* leads recibidos;
* tiempo hasta primera respuesta;
* leads clasificados;
* leads con seguimiento;
* cotizaciones;
* conversiones;
* ventas;
* valor de ventas;
* conversión por canal;
* conversión por tipo de cliente;
* leads perdidos por falta de seguimiento.

---

# 19. Canales y atribución

Cuando sea posible, conservar la fuente:

FUENTE_LEAD

Valores potenciales:

* WHATSAPP
* FACEBOOK
* INSTAGRAM
* TIKTOK
* WEBSITE
* FORMULARIO
* REFERIDO
* OTRO

Esto permitirá posteriormente saber qué canal genera mejores ventas.

---

# 20. Arquitectura técnica

El proyecto utiliza:

Kommo
↓
API oficial
↓
Configuración automatizada

El código debe encargarse de crear/configurar:

* pipelines;
* etapas;
* campos;
* etiquetas;
* Salesbots;
* automatizaciones compatibles;
* tareas;
* configuraciones permitidas por API.

No desarrollar un CRM paralelo salvo que sea estrictamente necesario.

---

# 21. Principio de idempotencia

El instalador debe poder ejecutarse varias veces.

No debe generar:

* pipelines duplicados;
* campos duplicados;
* etiquetas duplicadas;
* bots duplicados;

si ya existen.

Primero buscar.

Después crear únicamente lo necesario.

---

# 22. Principio de seguridad

Nunca:

* guardar tokens en Git;
* imprimir tokens;
* enviar tokens al frontend;
* colocar tokens en documentación pública;
* subir `.env`;
* compartir credenciales en mensajes.

Las credenciales deben permanecer en variables de entorno/secret manager.

---

# 23. No inventar API

Si Kommo no documenta una operación:

NO intentar hackearla.

NO hacer scraping.

NO manipular endpoints internos.

NO asumir que un endpoint existe.

Marcar:

MANUAL_REQUIRED

y documentar qué debe hacer el administrador desde la interfaz.

---

# 24. Resultado final deseado

La experiencia ideal:

Una persona escribe por cualquier canal conectado.

↓

Kommo recibe el lead.

↓

Respuesta automática inmediata.

↓

El sistema pregunta qué necesita.

↓

Cliente elige:

Público / Mayoreo / Distribuidor / Franquicia.

↓

El sistema clasifica.

↓

Se mueve al flujo correcto.

↓

Se recopilan los datos necesarios.

↓

Se envía información.

↓

Se crea seguimiento.

↓

Si es necesario, se asigna vendedor.

↓

El vendedor recibe un lead ya organizado.

↓

El cliente recibe seguimiento.

↓

Se registra venta o cierre.

---

# 25. Lo que NO queremos

No queremos:

* un chatbot que intente responder cualquier cosa;
* IA inventando precios;
* IA negociando descuentos;
* IA prometiendo condiciones comerciales;
* automatización agresiva;
* spam;
* respuestas genéricas interminables;
* un CRM excesivamente complicado;
* desarrollo de un CRM desde cero.

Queremos:

RESPUESTA RÁPIDA
+
CLASIFICACIÓN
+
SEGUIMIENTO
+
VENDEDOR HUMANO CUANDO SEA NECESARIO
====================================

MÁS OPORTUNIDADES DE VENTA
