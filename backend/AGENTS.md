# AGENTS.md — Backend

Estas reglas complementan `/AGENTS.md`.

## Stack

- NestJS
- TypeScript
- TypeORM
- PostgreSQL

Mantener la arquitectura existente.

## Arquitectura

Respetar responsabilidades.

### Domain

Entidades, contratos y reglas de dominio.

No introducir dependencias de NestJS, HTTP o TypeORM innecesariamente.

### Application

DTO internos, casos de uso, orquestación y reglas de aplicación.

La lógica de negocio no debe trasladarse al controller.

### Infrastructure

TypeORM, PostgreSQL, repositorios concretos, generación de archivos y servicios externos.

### Presentation

Controllers, DTO HTTP, Swagger, Guards y transporte.

Controllers delgados.

## Antes de implementar

Buscar primero:

- entidad existente;
- DTO existente;
- repository;
- caso de uso;
- servicio de dominio;
- helper;
- endpoint;
- test relacionado.

Extender lo existente antes de duplicar lógica.

## TypeORM

Usar aliases reales de los QueryBuilder.

No insertar expresiones SQL complejas directamente en `orderBy()` si TypeORM
puede interpretarlas como aliases durante paginación/getManyAndCount.

Para ordenamientos calculados:

- preferir columnas/aliases seguros;
- usar whitelist explícita;
- nunca concatenar campos recibidos del usuario.

Con paginación:

- aplicar filtros;
- aplicar ORDER BY;
- después `skip/take`;
- mantener desempate estable, normalmente por `id`.

Evitar N+1.

Preferir agregaciones bulk cuando se calculen datos de múltiples préstamos.

## DTO y validación

Mantener `class-validator` / `class-transformer`.

Un campo opcional vacío proveniente de formularios debe normalizarse cuando sea
necesario antes de aplicar validadores como `@IsEmail()`.

No relajar validaciones de otros campos para resolver un problema puntual.

## Transacciones financieras

Pago, Caja, cambio de estado, plan e historial deben conservar la atomicidad existente.

No separar operaciones actualmente transaccionales.

Usar locks existentes cuando una operación modifica simultáneamente:

- préstamo;
- cuotas;
- pagos;
- saldos;
- Caja.

Mantener orden determinista de locks para reducir deadlocks.

Si falla cualquier parte de una operación financiera, aplicar rollback total.

## Regla crítica de negocio: fidelidad del pago real

En el módulo de Pagos, `pago.monto` representa SIEMPRE el dinero real
efectivamente recibido del cliente.

Nunca se debe:

- completar artificialmente;
- reducir artificialmente;
- normalizar;
- limitar al monto programado de la cuota;
- sustituir por el monto pendiente de una cuota.

El pago representa un hecho financiero real.

El plan de pagos representa la programación de la deuda.

Por tanto:

**el plan debe adaptarse al pago real y nunca el pago al plan.**

### Reglas del monto pagado

Si una cuota programada es de ₡100.000:

#### Pago menor

Si el cliente paga:

₡50.000

debe persistirse:

`pago.monto = 50000`

El sistema NO debe registrar ₡100.000.

La diferencia de ₡50.000 debe trasladarse a la siguiente cuota operativa.

Ejemplo:

- Cuota 4 programada: ₡100.000
- Pago real: ₡50.000
- Faltante: ₡50.000
- Cuota 5 original: ₡100.000
- Cuota 5 ajustada: ₡150.000

La cuota anterior puede conservar estado `PARCIAL` como evidencia histórica,
pero el faltante no debe permanecer simultáneamente como deuda operativa en
la cuota anterior y en la siguiente.

Nunca duplicar saldo.

#### Pago exacto

Si el cliente paga:

₡100.000

debe persistirse:

`pago.monto = 100000`

No debe redistribuirse el plan futuro.

#### Pago mayor

Si el cliente paga:

₡150.000

debe persistirse:

`pago.monto = 150000`

El excedente de ₡50.000 debe reducir las cuotas posteriores.

Ejemplo:

- Cuota 4: ₡100.000
- Pago real: ₡150.000
- Excedente: ₡50.000
- Cuota 5 original: ₡100.000
- Cuota 5 ajustada: ₡50.000

No crear pagos ficticios para distribuir el excedente.

## Límite del pago

Un pago NO debe limitarse por el monto de la cuota seleccionada.

La validación debe respetar el saldo financiero total pendiente del préstamo.

Conceptualmente:

`montoPago <= capitalPendiente + interesPendiente`

Un cliente puede pagar más que la cuota programada para:

- ponerse al día;
- adelantar;
- reducir cuotas posteriores.

Ejemplo:

Saldo total pendiente: ₡250.000  
Cuota seleccionada: ₡100.000  
Pago real: ₡150.000

El pago debe permitirse.

## Aplicación financiera del pago

Mantener la regla vigente:

1. aplicar primero a CAPITAL;
2. aplicar luego a INTERÉS.

Debe cumplirse siempre:

`pago.monto = capitalAplicado + interesAplicado`

No modificar esta prioridad desde cambios de plan, frontend o reportes.

## Redistribución del plan

La redistribución debe conservar el saldo financiero total.

Después de registrar un pago:

`saldoAntes - pagoReal = saldoDespués`

Nunca debe ocurrir que trasladar un faltante aumente artificialmente la deuda.

### `redistribuyoPlan`

Para pagos nuevos:

- `false`: pago exacto que no modificó cuotas futuras;
- `true`: el pago modificó el plan futuro por faltante o excedente;
- `null`: únicamente datos históricos donde no existe certeza suficiente.

Un pago menor que traslada faltante:

`redistribuyoPlan = true`

Un pago mayor que reduce cuotas futuras:

`redistribuyoPlan = true`

Un pago exacto:

`redistribuyoPlan = false`

## Pago parcial y continuidad de cuotas

Cuando un pago menor a la cuota traslada su faltante a la siguiente cuota,
la cuota anterior no debe continuar bloqueando operativamente el avance del plan.

Ejemplo:

Plan:

- Cuota 4: ₡100.000
- Cuota 5: ₡100.000
- Cuota 6: ₡100.000

Pago real en cuota 4:

₡50.000

Resultado operativo:

- Cuota 4: PARCIAL, pago histórico ₡50.000
- Cuota 5: ₡150.000
- Cuota 6: ₡100.000

Si posteriormente el cliente paga ₡150.000 para ponerse al día:

- registrar `pago.monto = 150000`;
- permitir registrar sobre la cuota 5;
- no obligar a volver a registrar el pago sobre la cuota 4;
- conservar el pago histórico de ₡50.000.

## Plan de pagos

No inferir la cuota de un pago por:

- fecha;
- monto;
- posición.

Usar la relación existente:

`pago.plan_pago_id`

No modificar pagos históricos al redistribuir el plan operativo.

Trabajar con dinero en centavos cuando la lógica requiera redistribución exacta.

En planes personalizados:

- preservar fechas personalizadas;
- no regenerar el plan desde periodicidad;
- modificar únicamente montos futuros cuando corresponda.

## Última cuota

Si un pago menor ocurre sobre la última cuota y no existe una cuota posterior:

NO crear una nueva cuota silenciosamente.

No inventar comportamiento.

Si el dominio no define claramente el caso, detener implementación y solicitar
decisión de negocio.

## Pagos anulados

Los pagos `ANULADO`:

- no cuentan como dinero recibido;
- no participan en agregados financieros;
- no deben modificar su monto histórico;
- no deben modificar `capitalAplicado`;
- no deben modificar `interesAplicado`.

La anulación conserva auditoría.

No eliminar físicamente pagos.

La posibilidad de anulación automática debe respetar la política existente de
`redistribuyoPlan`.

Actualmente:

- `redistribuyoPlan = false`: puede ser candidato a anulación;
- `redistribuyoPlan = true`: no reconstruir automáticamente el plan;
- `redistribuyoPlan = null`: información histórica insuficiente.

No debilitar esta regla desde cambios de frontend.

## Caja

Caja debe reflejar únicamente movimiento real de dinero.

Al registrar un pago:

`PAGO_CLIENTE / ENTRADA`

por exactamente:

`pago.monto`

Si el cliente pagó ₡50.000:

Caja registra ₡50.000.

Nunca registrar el monto programado de la cuota si fue diferente al dinero recibido.

No crear movimientos de Caja desde operaciones que no representan movimiento real
de dinero.

## Análisis financiero

Toda métrica de dinero recibido debe basarse en hechos reales.

Usar pagos `REGISTRADO`.

No confundir:

- cuota programada;
- capital contractual;
- capital trasladado;
- dinero realmente desembolsado;
- dinero realmente recibido;
- interés pactado;
- interés efectivamente cobrado.

El comportamiento del cliente debe conservarse fielmente para permitir analizar:

- cumplimiento;
- pagos parciales;
- pagos adelantados;
- capacidad de ponerse al día;
- compromiso;
- refinanciamientos;
- rentabilidad;
- flujo real de efectivo.

## Refinanciamiento y Caja

No alterar reglas de refinanciamiento desde cambios de planes, listados o reportes.

El capital trasladado NO representa nueva salida de dinero.

Solo `montoNuevoDesembolsado` representa dinero nuevo en un refinanciamiento.

No crear movimientos de Caja por capital trasladado.

## Reportes

Reutilizar reportes existentes cuando corresponda.

No crear un PDF nuevo si el reporte existente puede reflejar correctamente los
datos actuales.

Los reportes financieros deben utilizar datos reales persistidos y no reconstruir
pagos ficticios para hacer coincidir cuotas programadas.

## Swagger

Mantener Swagger y documentación DTO existente.

No sustituir Swagger por otra interfaz salvo solicitud expresa.

## Base de datos

No usar `synchronize` como sustituto de una migración deliberada.

No generar migraciones por cambios que no modifican esquema.

No modificar migraciones ya ejecutadas.

Crear una nueva migración cuando el esquema realmente cambie.

## Rendimiento

Evitar N+1.

Preferir:

- joins controlados;
- consultas agregadas;
- procesamiento bulk;
- conjuntos únicos de IDs.

No ejecutar una consulta por cuota, préstamo, pago o refinanciamiento cuando pueda
resolverse con una consulta bulk.

## Compatibilidad

Antes de cambiar contratos HTTP:

- buscar consumidores frontend;
- revisar tests;
- preservar compatibilidad cuando sea razonable.

No cambiar respuestas existentes únicamente para simplificar una implementación
local si el frontend puede refrescar mediante endpoints ya disponibles.

## No duplicar reglas

La autoridad de las reglas financieras debe permanecer en backend.

Frontend puede:

- mostrar previews;
- facilitar acciones;
- ocultar acciones no disponibles.

Frontend NO debe convertirse en la fuente definitiva de:

- saldo;
- elegibilidad;
- redistribución;
- capital aplicado;
- interés aplicado;
- puedeAnular;
- estado financiero.

## Verificación

Después de cambios backend, según alcance:

```bash
npm run build
npm test