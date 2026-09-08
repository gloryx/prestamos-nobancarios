# AGENTS.md — Préstamos No Bancarios

## Proyecto

Sistema web de administración de préstamos no bancarios.

Stack:
- Backend: NestJS + TypeScript + TypeORM + PostgreSQL.
- Frontend: React + TypeScript + Vite.
- Arquitectura limpia existente.

Este archivo contiene reglas globales. Las reglas de `backend/AGENTS.md` y
`frontend/AGENTS.md` complementan estas instrucciones en sus respectivos ámbitos.

## Regla fundamental

Antes de modificar código:
1. Inspeccionar la implementación real.
2. Reutilizar entidades, DTO, endpoints, casos de uso, componentes y patrones existentes.
3. No asumir nombres, relaciones, campos ni comportamiento.
4. Hacer el cambio mínimo necesario para cumplir la solicitud.

Si el usuario dice "únicamente", "solamente", "no cambies nada más" o equivalente,
tratarlo como una restricción estricta de alcance.


## Fuente de verdad

Cuando exista contradicción:

1. La solicitud actual del usuario define el objetivo.
2. Los archivos AGENTS.md definen las restricciones permanentes.
3. El código y esquema actuales definen la implementación existente.
4. Los tests verifican comportamiento, pero no sustituyen una regla de negocio
   expresamente aprobada.

No modificar una regla de negocio vigente únicamente para hacer pasar un test
antiguo que la contradiga.

## Cuándo detenerse

## Auditorías

Si se solicita una auditoría:
- trabajar en modo solo lectura;
- no modificar código;
- no crear archivos;
- no ejecutar migraciones;
- no hacer commits;
- identificar implementación actual, riesgos, impacto y archivos involucrados;
- detenerse después del reporte.

No implementar hasta que el usuario lo solicite.

## Cambios existentes

El árbol de trabajo puede contener cambios válidos de tareas anteriores.

Nunca usar automáticamente:
- `git reset`;
- `git checkout .`;
- `git restore` masivo;
- limpieza destructiva;
- reversión de archivos ajenos a la tarea.

No sobrescribir ni revertir cambios existentes sin verificar su origen.

## Git

No ejecutar `git commit` ni `git push` salvo solicitud explícita.

Al finalizar reportar siempre:
- commits realizados: ninguno, si corresponde.

## Base de datos

Base real: PostgreSQL.
ORM: TypeORM.

No crear tablas, columnas, índices, constraints ni migraciones salvo que el
cambio realmente lo requiera.

Si una modificación requiere cambiar esquema:
1. detectarlo;
2. explicar por qué;
3. no aplicar una alternativa estructural distinta sin autorización.

No afirmar que algo fue validado contra PostgreSQL real si solo se ejecutaron
mocks o pruebas unitarias.

## Reglas financieras protegidas

Los pagos son hechos históricos.

No modificar pagos históricos para adaptar planes, reportes o interfaces.

Mantener:
- `pago.plan_pago_id`;
- asignación capital primero y luego interés;
- consistencia Pago/Caja;
- atomicidad de operaciones financieras;
- refinanciamientos existentes;
- historial existente.

`plan_pago` es el plan operativo y puede adaptarse a los pagos reales según las
reglas ya implementadas.

No crear otra tabla para conservar el plan original sin autorización.

## Regla de secuencia de pagos

Los pagos deben registrarse siempre sobre la primera cuota del plan operativo
que tenga saldo pendiente.

No se permiten pagos fuera de secuencia.

Si existe una cuota PENDIENTE o PARCIAL anterior, no se puede registrar el pago
sobre una cuota posterior.

La secuencia de cuotas es obligatoria, pero el monto del pago es flexible.

Sobre la primera cuota pendiente/parcial el cliente puede pagar:
- menos que el monto de la cuota;
- exactamente el monto de la cuota;
- más que el monto de la cuota;
- un monto suficiente para cubrir varias cuotas;
- todo el saldo financiero pendiente.

El monto recibido debe cumplir:

- monto > 0;
- máximo dos decimales;
- monto <= saldo financiero pendiente del préstamo.

El plan operativo debe adaptarse al monto realmente recibido según las reglas
existentes de redistribución.

Un pago menor, mayor o equivalente a varias cuotas no debe rechazarse únicamente
porque no coincide con el montoProgramado de la cuota.

La flexibilidad corresponde al MONTO, no al ORDEN de las cuotas.

Mantener siempre:
- `pago.plan_pago_id` asociado a la cuota atendida;
- Pago como hecho histórico;
- Caja por el dinero realmente recibido;
- capital primero y luego interés;
- saldo financiero como fuente de verdad;
- atomicidad de la operación.

La prioridad del sistema es registrar correctamente el dinero recibido sin romper
la secuencia operativa, el saldo, Caja ni el historial.

## Estados

Estados administrativos del préstamo:
- ACTIVO
- CANCELADO
- REFINANCIADO
- INCOBRABLE

No agregar ni modificar `EstadoPrestamo` sin autorización.

Indicador de cobranza:
- AL_DIA
- ATRASADO
- PLAZO_CUMPLIDO
- SALDADO

Es calculado y NO debe persistirse como estado del préstamo.

## Listados

Cuando exista paginación server-side:
- filtrar y ordenar en backend antes de paginar;
- nunca ordenar solamente la página visible;
- conservar filtros al paginar;
- volver a página 1 cuando cambie un filtro u orden;
- mantener un orden estable para evitar saltos entre páginas.

Los resúmenes representan todo el conjunto filtrado, no solamente la página visible.

Usar componentes `shared` existentes cuando corresponda en varios módulos.

## Reutilización compartida

Antes de crear una implementación nueva, buscar componentes y utilidades existentes
en `shared`.

Cuando exista un componente compartido para una función, reutilizarlo salvo que
exista una incompatibilidad técnica demostrable.

Especialmente:
- paginación;
- confirmaciones SweetAlert;
- modales comunes;
- controles repetidos.

No simular paginación frontend cuando el listado requiere paginación server-side.

## Seguridad

Mantener autenticación JWT y autorización por roles existentes.

El usuario actor debe provenir del contexto autenticado cuando corresponda.

No confiar en IDs de usuario actor enviados desde frontend.

`cobradorId` es una relación independiente del usuario autenticado.

No devolver `passwordHash`.

## Cambios no relacionados

No aprovechar una tarea para:
- refactorizar código ajeno;
- cambiar nombres;
- reorganizar carpetas;
- actualizar dependencias;
- cambiar estilos globales;
- corregir warnings antiguos;
- agregar funcionalidades no solicitadas.

## Verificación

Ejecutar únicamente verificaciones relacionadas con el cambio.

No modificar código ajeno solamente para hacer desaparecer warnings preexistentes.

Si una prueba falla por una causa previa/no relacionada, reportarlo claramente.

## Entrega

Al terminar, reportar de forma breve:
1. archivos modificados;
2. cambio realizado;
3. build;
4. tests/lint correspondientes;
5. migraciones;
6. commits.

No continuar con mejoras adicionales sin solicitud.



Detener la implementación y reportar antes de continuar si:

- aparece una decisión de negocio no definida;
- se requiere una tabla o migración no prevista;
- el cambio puede modificar pagos históricos;
- puede romper la consistencia Pago/Caja;
- requiere cambiar un contrato utilizado por otros módulos;
- contradice una regla financiera existente;
- no puede determinarse con seguridad si un cambio existente pertenece a otra tarea.

No elegir arbitrariamente una nueva regla de negocio.