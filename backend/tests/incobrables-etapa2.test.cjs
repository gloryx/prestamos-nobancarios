const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('incobrable eligibility is based on persisted overdue plan obligations and registered plan payments', () => {
  const repository = read('src/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository.ts')
  assert.match(repository, /prestamo\.estado = :active/)
  assert.match(repository, /prestamo\.monto_total - \$\{paidLoan\} > 0/)
  assert.match(repository, /EXISTS \(SELECT 1 FROM plan_pago pp/)
  assert.match(repository, /pp\.fecha_vencimiento < :fecha/)
  assert.match(repository, /const paidPlan = .*p1\.plan_pago_id = pp\.id/)
  assert.match(repository, /p1\.estado = .*REGISTRADO/)
  assert.match(repository, /p0\.prestamo_id = prestamo\.id.*REGISTRADO/)
  assert.match(repository, /INCOBRABLE/)
})

test('incobrables listing uses latest cycle transition and bulk payment date aggregation', () => {
  const repository = read('src/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository.ts')
  assert.match(repository, /ORDER BY h\.fecha DESC, h\.id DESC LIMIT 1/)
  assert.match(repository, /MAX\(p5\.fecha\)/)
  assert.doesNotMatch(repository, /entities\.map\([^\n]*buscarPorId/)
})

test('state transition protects the incobrable cycle with explicit date, observation and revalidation', () => {
  const useCase = read('src/modules/prestamos/application/use-cases/cambiar-estado-prestamo.use-case.ts')
  assert.match(useCase, /La fecha efectiva es obligatoria/)
  assert.match(useCase, /La observación es obligatoria/)
  assert.match(useCase, /this\.incobrables\.esElegible\(id, dto\.fecha/)
  assert.match(useCase, /this\.periods\.assertOpen\(manager, effectiveDate\)/)
})

test('incobrable screen keeps the backend repository boundary and admin route', () => {
  const page = read('../frontend/src/features/prestamos/presentation/GestionIncobrablesPage.tsx')
  const router = read('../frontend/src/app/router/AppRouter.tsx')
  assert.match(page, /listarCandidatosIncobrables/)
  assert.match(page, /listarIncobrables/)
  assert.match(page, /fecha/)
  assert.match(page, /observacion/)
  assert.match(router, /prestamos\/gestion-incobrables/)
})
