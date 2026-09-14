
### 3. `/frontend/AGENTS.md`

```markdown
# AGENTS.md — Frontend

Estas reglas complementan `/AGENTS.md`.

## Stack

- React
- TypeScript
- Vite

Mantener estructura y arquitectura existentes.

## Regla principal

Antes de crear:
- componente;
- hook;
- repository;
- adapter;
- modal;
- alerta;
- paginación;
- estilo reutilizable;

buscar si ya existe una implementación compartida.

Reutilizar antes de duplicar.

## Alcance visual

Cuando el usuario solicite un cambio visual puntual:
- modificar únicamente los elementos indicados;
- no rediseñar la pantalla completa;
- no alterar comportamiento de negocio;
- no cambiar otras columnas, filtros o componentes.

Mantener coherencia visual con el sistema existente.

## Componentes shared

Usar componentes shared cuando el mismo patrón se utiliza en varios módulos.

Ejemplos:
- paginación;
- confirmaciones;
- modales comunes;
- controles repetidos.

Un componente shared debe ser genérico.

No debe contener:
- requests específicos;
- repositories;
- reglas financieras;
- nombres hardcodeados como "clientes" o "préstamos".

Debe recibir datos y callbacks mediante props.

## Listados

Mantener separados:
- filtros;
- ordenamiento;
- paginación;
- resumen;
- exportación.

Cambiar página no debe recalcular un resumen que depende únicamente de filtros.

Cambiar orden no debe recalcular el resumen.

Exportaciones filtradas no deben depender de la página visible salvo requisito
expreso.

Al cambiar filtros u orden:
- volver a página 1.

Conservar filtros y orden al cambiar página.

## Paginación

Usar el componente shared existente cuando esté disponible.

Mantener:
- página válida;
- límite permitido por backend;
- total;
- totalPaginas;
- estados disabled;
- loading;
- comportamiento responsive.

Evitar que respuestas HTTP antiguas sobrescriban solicitudes más recientes.

Reutilizar el patrón de cancelación/request sequence ya existente.

## Ordenamiento

Con paginación server-side, enviar el orden al backend.

Nunca ordenar solamente el array de la página visible para simular orden global.

Mostrar visualmente ASC/DESC sin duplicar reglas de ordenamiento backend.

## Formularios

Frontend no debe inventar reglas diferentes del backend.

Campos opcionales vacíos:
- omitirlos o normalizarlos según el contrato existente;
- no enviar cadenas vacías cuando el backend espera ausencia/undefined.

Mantener validaciones de formato cuando existe un valor.

## Errores y confirmaciones

No usar `window.alert()` si el proyecto ya posee un sistema moderno compartido.

Reutilizar SweetAlert/confirmación compartida existente.

Mostrar mensajes backend útiles sin exponer información técnica innecesaria.

## Dinero

No recalcular reglas financieras críticas únicamente en frontend.

El backend es la fuente de verdad para:
- saldos;
- aplicación capital/interés;
- estado financiero;
- indicador de cobranza;
- redistribución definitiva del plan.

Frontend puede mostrar previews, pero debe consumir el resultado backend definitivo.

## Regla crítica: pagos y plan de cuotas

El frontend NO es la autoridad de las reglas financieras.

La lógica de:

- aplicación del pago;
- capital aplicado;
- interés aplicado;
- saldo pendiente;
- redistribución de cuotas;
- faltantes;
- excedentes;
- `redistribuyoPlan`;
- `puedeAnular`;

pertenece al backend.

### Registro del monto real

El campo de monto debe permitir registrar el dinero REAL entregado por el cliente.

No limitar el monto del pago al monto programado de la cuota seleccionada.

Un cliente puede:

- pagar menos que la cuota;
- pagar exactamente la cuota;
- pagar más que la cuota;
- ponerse al día;
- adelantar pagos;

siempre sujeto a las validaciones financieras devueltas por el backend.

Ejemplo:

Cuota mostrada: ₡100.000
Pago real del cliente: ₡50.000

El frontend debe enviar:

monto: 50000

Nunca completar automáticamente el pago a ₡100.000.

Si posteriormente la cuota operativa es de ₡150.000 y el cliente paga ₡150.000,
debe enviarse:

monto: 150000

### Plan después de registrar un pago

Después de registrar, editar o realizar una operación que pueda modificar el plan,
el frontend debe refrescar desde backend los datos necesarios.

No calcular localmente:

- nueva cuota;
- faltante trasladado;
- excedente;
- saldo resultante;
- estado financiero del préstamo.

El backend es la fuente de verdad.

Ejemplo:

Cuota 4: ₡100.000
Pago real: ₡50.000

Si backend devuelve posteriormente:

Cuota 4: PARCIAL
Cuota 5: ₡150.000

el frontend debe representar exactamente ese resultado.

No reconstruir localmente ₡150.000.

## Cuotas parciales

Una cuota `PARCIAL` puede representar un hecho histórico aunque su faltante haya
sido trasladado por backend a una cuota posterior.

No asumir que toda cuota `PARCIAL` debe bloquear necesariamente la siguiente cuota.

Las acciones disponibles deben basarse en las reglas/estado entregados por backend.

No reimplementar en React la secuencia financiera de cuotas.

## Pagos anulados

Los pagos `ANULADO` no deben mostrarse como pagos vigentes dentro del plan cuando
la interfaz actual haya definido ocultarlos.

No eliminarlos ni reinterpretarlos desde frontend.

La posibilidad de mostrar la acción Anular debe depender de `puedeAnular`
proporcionado por backend y de los permisos correspondientes.

## Fidelidad visual

La interfaz debe distinguir claramente entre:

- monto programado;
- monto realmente pagado;
- monto pendiente;
- estado de la cuota.

Nunca presentar el monto programado como si fuera el dinero efectivamente recibido.

Los análisis y reportes deben utilizar los campos financieros proporcionados por
backend sin reconstruir totales a partir de valores visuales del plan.

## CSS

Evitar:
- duplicar estilos shared;
- cambios globales para resolver un problema local;
- `!important` innecesario;
- anchos rígidos que rompan responsive.

Cuando se solicite cambiar una columna específica, modificar solamente los estilos
necesarios para esa columna.

## Dependencias

No instalar una librería nueva si la funcionalidad puede resolverse razonablemente
con React, TypeScript o dependencias ya instaladas.

Solicitudes pequeñas no justifican refactorizaciones grandes.

## Verificación

Después de cambios frontend:

```bash
npm run build
npm run lint