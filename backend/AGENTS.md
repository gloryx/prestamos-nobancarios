# AGENTS.md — Backend

Estas reglas complementan `/AGENTS.md`.

## Stack

- NestJS
- TypeScript
- TypeORM
- PostgreSQL

Mantener la arquitectura existente.

## Arquitectura

Respetar responsabilidades:

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

Mantener `class-validator`/`class-transformer`.

Un campo opcional vacío proveniente de formularios debe normalizarse cuando sea
necesario antes de aplicar validadores como `@IsEmail()`.

No relajar validaciones de otros campos para resolver un problema puntual.

## Transacciones financieras

Pago, Caja, cambio de estado e historial deben conservar la atomicidad existente.

No separar operaciones actualmente transaccionales.

Usar locks existentes cuando una operación modifica simultáneamente préstamo,
cuotas o saldos.

Mantener orden determinista de locks para reducir deadlocks.

## Plan de pagos

No inferir la cuota de un pago por:
- fecha;
- monto;
- posición.

Usar la relación existente `pago.plan_pago_id`.

No modificar pagos históricos al redistribuir el plan operativo.

Trabajar con dinero en centavos cuando la lógica requiera redistribución exacta.

## Refinanciamiento y Caja

No alterar reglas de refinanciamiento desde cambios de planes/listados/reportes.

No crear movimientos de Caja desde operaciones que no representan movimiento real
de dinero.

## Reportes

Reutilizar reportes existentes cuando corresponda.

No crear un PDF nuevo si el reporte existente puede reflejar correctamente los
datos actuales.

## Swagger

Mantener Swagger y documentación DTO existente.

No sustituir Swagger por otra interfaz salvo solicitud expresa.

## Base de datos

No usar `synchronize` como sustituto de una migración deliberada.

No generar migraciones por cambios que no modifican esquema.

## Verificación

Después de cambios backend, según alcance:

```bash
npm run build
npm test