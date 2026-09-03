const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { LoginUseCase, verifyPassword } = require('../dist/modules/auth/application/login.use-case');
const { JwtStrategy } = require('../dist/modules/auth/jwt.strategy');
const { CambiarPasswordUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/cambiar-password-usuario.use-case');
const { CrearUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/crear-usuario.use-case');
const { ActualizarUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/actualizar-usuario.use-case');
const { RolesGuard } = require('../dist/modules/auth/roles.guard');
const { JwtAuthGuard } = require('../dist/modules/auth/jwt-auth.guard');
const { AuthModule } = require('../dist/modules/auth/auth.module');
const { UsuariosModule } = require('../dist/modules/usuarios/usuarios.module');
const { USUARIO_REPOSITORY } = require('../dist/modules/usuarios/domain/repositories/usuario.repository');
const { RolUsuario } = require('../dist/modules/usuarios/domain/enums/rol-usuario.enum');
const { Test } = require('@nestjs/testing');
const { Controller, Get, Module } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { Roles } = require('../dist/modules/auth/auth.decorators');
const { JwtService } = require('@nestjs/jwt');
const { PagosController } = require('../dist/modules/pagos/presentation/controllers/pagos.controller');
const { RegistrarPagoUseCase } = require('../dist/modules/pagos/application/use-cases/registrar-pago.use-case');
const { ListarPagosUseCase } = require('../dist/modules/pagos/application/use-cases/listar-pagos.use-case');
const { ObtenerPagoPorIdUseCase } = require('../dist/modules/pagos/application/use-cases/obtener-pago-por-id.use-case');
const { ListarPagosPorPrestamoUseCase } = require('../dist/modules/pagos/application/use-cases/listar-pagos-por-prestamo.use-case');
const { ObtenerResumenPagoPrestamoUseCase } = require('../dist/modules/pagos/application/use-cases/obtener-resumen-pago-prestamo.use-case');
const { ObtenerEstadoPlanUseCase } = require('../dist/modules/pagos/application/use-cases/obtener-estado-plan.use-case');
require('reflect-metadata');

const config = { get: key => key === 'JWT_EXPIRES_IN' ? '2h' : undefined };
const user = (overrides = {}) => ({ id: 1, identificacion: 'ABC-1', nombreCompleto: 'ANA', rol: 'VENDEDOR', activo: true, passwordHash: bcrypt.hashSync('correcta123', 12), fechaCreacion: new Date(), fechaActualizacion: new Date(), ...overrides });

test('login returns JWT access token and safe user without passwordHash', async () => {
  const jwt = { signAsync: async payload => `token:${payload.sub}:${payload.rol}` };
  const result = await new LoginUseCase({ buscarPorIdentificacion: async () => user() }, jwt, config).execute({ identificacion: 'ABC-1', password: 'correcta123' });
  assert.equal(result.accessToken, 'token:1:VENDEDOR');
  assert.equal(result.tokenType, 'Bearer');
  assert.equal(result.expiresIn, '2h');
  assert.equal(result.usuario.password, undefined);
  assert.equal(result.usuario.passwordHash, undefined);
  assert.equal(result.usuario.identificacion, 'ABC-1');
});

test('login normalizes identification in the application layer', async () => {
  let received;
  const repository = { buscarPorIdentificacion: async identification => { received = identification; return user(); } };
  const jwt = { signAsync: async () => 'token' };
  await new LoginUseCase(repository, jwt, config).execute({ identificacion: '  abc-1  ', password: 'correcta123' });
  assert.equal(received, 'ABC-1');
});

test('login returns the same 401 for unknown user and wrong password, and 403 for inactive user', async () => {
  const jwt = { signAsync: async () => 'token' };
  const unknown = new LoginUseCase({ buscarPorIdentificacion: async () => null }, jwt, config);
  const wrong = new LoginUseCase({ buscarPorIdentificacion: async () => user() }, jwt, config);
  const inactive = new LoginUseCase({ buscarPorIdentificacion: async () => user({ activo: false }) }, jwt, config);
  await assert.rejects(() => unknown.execute({ identificacion: 'x', password: 'bad' }), e => e.status === 401 && e.message === 'Credenciales inválidas.');
  await assert.rejects(() => wrong.execute({ identificacion: 'x', password: 'bad' }), e => e.status === 401 && e.message === 'Credenciales inválidas.');
  await assert.rejects(() => inactive.execute({ identificacion: 'x', password: 'correcta123' }), e => e.status === 403 && e.message === 'El usuario está inactivo.');
});

test('bcrypt and inherited scrypt password formats are verified without plaintext storage', async () => {
  const crypto = require('node:crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const legacy = `scrypt:${salt}:${crypto.scryptSync('legacy123', salt, 64).toString('hex')}`;
  assert.equal(await verifyPassword('correcta123', user().passwordHash), true);
  assert.equal(await verifyPassword('legacy123', legacy), true);
  assert.equal(await verifyPassword('bad', legacy), false);
});

test('strategy fetches current active user and ignores stale role in JWT', async () => {
  const current = user({ rol: 'ADMINISTRADOR' });
  const strategy = new JwtStrategy({ getOrThrow: () => 'secret' }, { buscarPorId: async () => current });
  const result = await strategy.validate({ sub: 1, rol: 'VENDEDOR' });
  assert.equal(result.rol, 'ADMINISTRADOR');
  await assert.rejects(() => new JwtStrategy({ getOrThrow: () => 'secret' }, { buscarPorId: async () => user({ activo: false }) }).validate({ sub: 1 }));
});

test('password change writes bcrypt and does not affect general update behavior', async () => {
  const current = user();
  const repository = { buscarPorId: async () => current, actualizar: async value => value };
  const result = await new CambiarPasswordUsuarioUseCase(repository).execute(1, 'nuevaClave123');
  assert.match(result.passwordHash, /^\$2/);
  assert.equal(await bcrypt.compare('nuevaClave123', result.passwordHash), true);
});

test('user creation writes bcrypt and general updates preserve the existing password hash', async () => {
  let saved;
  const current = user();
  current.actualizarDatos = data => Object.assign(current, data);
  const repository = {
    buscarPorIdentificacion: async () => null,
    buscarPorId: async () => current,
    guardar: async value => { saved = value; value.id = 9; return value; },
    actualizar: async value => value,
  };
  const created = await new CrearUsuarioUseCase(repository).execute({ identificacion: 'new-1', nombreCompleto: 'NEW USER', rol: RolUsuario.VENDEDOR, password: 'nuevaClave123' });
  assert.match(created.passwordHash, /^\$2/);
  assert.equal(await bcrypt.compare('nuevaClave123', created.passwordHash), true);
  const originalHash = current.passwordHash;
  const updated = await new ActualizarUsuarioUseCase(repository).execute(1, { nombreCompleto: 'UPDATED USER' });
  assert.equal(updated.passwordHash, originalHash);
  assert.equal(saved.passwordHash === created.passwordHash, true);
});

test('roles guard authorizes only the role from request.user', () => {
  const reflector = { getAllAndOverride: () => ['ADMINISTRADOR'] };
  const guard = new RolesGuard(reflector);
  const context = role => ({ getHandler: () => {}, getClass: () => {}, switchToHttp: () => ({ getRequest: () => ({ user: { rol: role } }) }) });
  assert.equal(guard.canActivate(context('ADMINISTRADOR')), true);
  assert.throws(() => guard.canActivate(context('VENDEDOR')), /permisos/);
});

test('global JwtAuthGuard keeps login public and protects /auth/me over HTTP', async t => {
  process.env.JWT_SECRET = 'integration-secret';
  process.env.JWT_EXPIRES_IN = '2h';
  const current = user({ id: 1, rol: RolUsuario.VENDEDOR });
  const repository = {
    buscarPorIdentificacion: async identification => identification === current.identificacion ? current : null,
    buscarPorId: async id => id === current.id ? current : null,
  };
  const app = await createHttpApp(repository);
  t.after(() => app.close());

  const login = await request(app, 'POST', '/auth/login', { identificacion: 'ABC-1', password: 'correcta123' });
  assert.equal(login.status, 201);
  assert.equal(login.body.tokenType, 'Bearer');
  assert.equal(login.body.usuario.passwordHash, undefined);
  assert.equal(login.body.usuario.password, undefined);

  const me = await request(app, 'GET', '/auth/me', undefined, login.body.accessToken);
  assert.equal(me.status, 200);
  assert.equal(me.body.id, current.id);
  assert.equal(me.body.passwordHash, undefined);
});

test('HTTP auth rejects missing, invalid, expired, and inactive tokens', async t => {
  process.env.JWT_SECRET = 'integration-secret';
  process.env.JWT_EXPIRES_IN = '2h';
  const current = user({ id: 2 });
  const repository = { buscarPorIdentificacion: async () => current, buscarPorId: async id => id === current.id ? current : null };
  const app = await createHttpApp(repository);
  t.after(() => app.close());
  const jwt = app.get(JwtService);
  const valid = await jwt.signAsync({ sub: current.id });
  const expired = await jwt.signAsync({ sub: current.id }, { expiresIn: -1 });

  assert.equal((await request(app, 'GET', '/auth/me')).status, 401);
  assert.equal((await request(app, 'GET', '/auth/me', undefined, 'not-a-token')).status, 401);
  assert.equal((await request(app, 'GET', '/auth/me', undefined, expired)).status, 401);
  assert.equal((await request(app, 'GET', '/auth/me', undefined, valid)).status, 200);
  current.activo = false;
  assert.equal((await request(app, 'GET', '/auth/me', undefined, valid)).status, 401);
});

test('HTTP role guard permits ADMINISTRADOR and denies VENDEDOR', async t => {
  process.env.JWT_SECRET = 'integration-secret';
  process.env.JWT_EXPIRES_IN = '2h';
  const current = user({ id: 3, rol: RolUsuario.ADMINISTRADOR });
  const repository = { buscarPorIdentificacion: async () => current, buscarPorId: async id => id === current.id ? current : null };
  const app = await createHttpApp(repository);
  t.after(() => app.close());
  const jwt = app.get(JwtService);
  const token = await jwt.signAsync({ sub: current.id });
  assert.equal((await request(app, 'GET', '/admin-probe', undefined, token)).status, 200);
  current.rol = RolUsuario.VENDEDOR;
  assert.equal((await request(app, 'GET', '/admin-probe', undefined, token)).status, 403);
});

test('P8 HTTP payment endpoint rejects missing JWT before invoking persistence', async t => {
  process.env.JWT_SECRET = 'integration-secret';
  process.env.JWT_EXPIRES_IN = '2h';
  let calls = 0;
  const app = await createPaymentHttpApp(() => { calls++; });
  t.after(() => app.close());

  const result = await request(app, 'POST', '/pagos', { prestamoId: 1, formaPagoId: 1, cobradorId: 5, monto: 50000, fecha: '2026-08-31' });
  assert.equal(result.status, 401);
  assert.equal(calls, 0, 'the protected endpoint must not invoke the payment use case');
});

class AdminProbeController { probe() { return { ok: true }; } }
Controller('admin-probe')(AdminProbeController);
Get()(AdminProbeController.prototype, 'probe', Object.getOwnPropertyDescriptor(AdminProbeController.prototype, 'probe'));
Roles(RolUsuario.ADMINISTRADOR)(AdminProbeController.prototype, 'probe', Object.getOwnPropertyDescriptor(AdminProbeController.prototype, 'probe'));

async function createHttpApp(repository) {
  class TestUsuariosModule {}
  Module({ providers: [{ provide: USUARIO_REPOSITORY, useValue: repository }], exports: [USUARIO_REPOSITORY] })(TestUsuariosModule);
  const moduleRef = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule], controllers: [AdminProbeController] })
    .overrideModule(UsuariosModule)
    .useModule(TestUsuariosModule)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function createPaymentHttpApp(onRegister) {
  class TestUsuariosModule {}
  Module({ providers: [{ provide: USUARIO_REPOSITORY, useValue: { buscarPorIdentificacion: async () => null, buscarPorId: async () => null } }], exports: [USUARIO_REPOSITORY] })(TestUsuariosModule);
  const noOp = {};
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
    controllers: [PagosController],
    providers: [
      { provide: RegistrarPagoUseCase, useValue: { execute: async () => onRegister() } },
      { provide: ListarPagosUseCase, useValue: noOp },
      { provide: ObtenerPagoPorIdUseCase, useValue: noOp },
      { provide: ListarPagosPorPrestamoUseCase, useValue: noOp },
      { provide: ObtenerResumenPagoPrestamoUseCase, useValue: noOp },
      { provide: ObtenerEstadoPlanUseCase, useValue: noOp },
    ],
  }).overrideModule(UsuariosModule).useModule(TestUsuariosModule).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function request(app, method, path, body, token) {
  const server = app.getHttpServer();
  if (!server.listening) await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
