const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ConfigModule } = require('@nestjs/config');
const { Module } = require('@nestjs/common');
const { AuthModule } = require('../dist/modules/auth/auth.module');
const { UsuariosModule } = require('../dist/modules/usuarios/usuarios.module');
const { UsuariosController } = require('../dist/modules/usuarios/presentation/controllers/usuarios.controller');
const { ListarUsuariosSelectorUseCase } = require('../dist/modules/usuarios/application/use-cases/listar-usuarios-selector.use-case');
const { CrearUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/crear-usuario.use-case');
const { ListarUsuariosUseCase } = require('../dist/modules/usuarios/application/use-cases/listar-usuarios.use-case');
const { ObtenerUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/obtener-usuario.use-case');
const { ActualizarUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/actualizar-usuario.use-case');
const { CambiarEstadoUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/cambiar-estado-usuario.use-case');
const { CambiarPasswordUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/cambiar-password-usuario.use-case');
const { JwtService } = require('@nestjs/jwt');
const { USUARIO_REPOSITORY } = require('../dist/modules/usuarios/domain/repositories/usuario.repository');

const users = [
  { id: 1, nombreCompleto: 'Activo', activo: true, passwordHash: 'secret', correo: 'private@example.com', telefono: '555' },
  { id: 2, nombreCompleto: 'Inactivo', activo: false, passwordHash: 'secret', correo: 'private@example.com', telefono: '555' },
];

test('GET /usuarios remains ADMIN-only while /usuarios/selector permits ADMIN and VENDEDOR with safe active projection', async t => {
  process.env.JWT_SECRET = 'selector-secret';
  const repository = {
    buscarPorId: async id => ({ id, rol: id === 1 ? 'ADMINISTRADOR' : 'VENDEDOR', activo: true }),
    buscarPorIdentificacion: async () => null,
    listarSelector: async () => users.filter(user => user.activo).map(({ id, nombreCompleto }) => ({ id, nombreCompleto })),
  };
  class TestUsuariosModule {}
  Module({ providers: [{ provide: USUARIO_REPOSITORY, useValue: repository }], exports: [USUARIO_REPOSITORY] })(TestUsuariosModule);
  const noOp = {};
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
    controllers: [UsuariosController],
    providers: [
      { provide: CrearUsuarioUseCase, useValue: noOp }, { provide: ListarUsuariosUseCase, useValue: noOp },
      { provide: ListarUsuariosSelectorUseCase, useValue: { execute: repository.listarSelector } },
      { provide: ObtenerUsuarioUseCase, useValue: noOp }, { provide: ActualizarUsuarioUseCase, useValue: noOp },
      { provide: CambiarEstadoUsuarioUseCase, useValue: noOp }, { provide: CambiarPasswordUsuarioUseCase, useValue: noOp },
    ],
  }).overrideModule(UsuariosModule).useModule(TestUsuariosModule).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  t.after(() => app.close());
  const jwt = app.get(JwtService);
  const admin = await jwt.signAsync({ sub: 1 });
  const seller = await jwt.signAsync({ sub: 2 });
  assert.equal((await request(app, '/usuarios/selector', admin)).status, 200);
  const selector = await request(app, '/usuarios/selector', seller);
  assert.equal(selector.status, 200);
  assert.deepEqual(selector.body, [{ id: 1, nombreCompleto: 'Activo' }]);
  for (const field of ['passwordHash', 'correo', 'telefono', 'rol', 'activo', 'fechaCreacion', 'fechaActualizacion']) assert.equal(selector.body[0][field], undefined);
  assert.equal((await request(app, '/usuarios', seller)).status, 403);
});

async function request(app, path, token) {
  const server = app.getHttpServer();
  if (!server.listening) await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.text();
  return { status: response.status, body: body ? JSON.parse(body) : null };
}
