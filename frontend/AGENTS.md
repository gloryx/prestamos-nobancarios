
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