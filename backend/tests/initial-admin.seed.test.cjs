const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { InitialAdminSeed } = require('../dist/modules/usuarios/application/initial-admin.seed');
const { CrearUsuarioUseCase } = require('../dist/modules/usuarios/application/use-cases/crear-usuario.use-case');
const { LoginUseCase } = require('../dist/modules/auth/application/login.use-case');
const { RolUsuario } = require('../dist/modules/usuarios/domain/enums/rol-usuario.enum');

const config = values => ({ get: key => values[key] });
const values = { SEED_ADMIN_IDENTIFICACION: ' admin-1 ', SEED_ADMIN_NOMBRE: 'Admin Inicial', SEED_ADMIN_TELEFONO: '8888-8888', SEED_ADMIN_CORREO: 'Admin@example.com', SEED_ADMIN_PASSWORD: 'correcta123' };
const repository = (users = []) => ({
  users,
  listar: async filters => ({ datos: filters.rol ? users.filter(user => user.rol === filters.rol) : users, pagina: 1, limite: 1, total: filters.rol ? users.filter(user => user.rol === filters.rol).length : users.length, totalPaginas: 1 }),
  buscarPorIdentificacion: async identification => users.find(user => user.identificacion === identification) ?? null,
  guardar: async user => { user.id = users.length + 1; users.push(user); return user; },
});

const seed = (repo, env = values) => new InitialAdminSeed(repo, new CrearUsuarioUseCase(repo), config(env));

test('seed creates one administrator with normalized data and bcrypt password', async () => {
  const repo = repository();
  await seed(repo).seed();
  assert.equal(repo.users.length, 1);
  assert.equal(repo.users[0].identificacion, 'ADMIN-1');
  assert.equal(repo.users[0].rol, RolUsuario.ADMINISTRADOR);
  assert.equal(repo.users[0].activo, true);
  assert.match(repo.users[0].passwordHash, /^\$2/);
  assert.equal(await bcrypt.compare(values.SEED_ADMIN_PASSWORD, repo.users[0].passwordHash), true);
});

test('existing administrator and concurrent starts do not create another one', async () => {
  const repo = repository();
  const first = seed(repo);
  await Promise.all([first.seed(), first.seed()]);
  await seed(repo).seed();
  assert.equal(repo.users.length, 1);
});

test('any existing administrator prevents seeding regardless of seed variables', async () => {
  for (const env of [{}, values]) {
    const existingAdmin = { identificacion: 'EXISTING-ADMIN', rol: RolUsuario.ADMINISTRADOR };
    const repo = repository([existingAdmin]);

    await seed(repo, env).seed();

    assert.deepEqual(repo.users, [existingAdmin]);
  }
});

test('missing seed variable fails when no administrator exists', async () => {
  const repo = repository();
  await assert.rejects(() => seed(repo, { ...values, SEED_ADMIN_PASSWORD: '' }).seed(), /SEED_ADMIN_PASSWORD es obligatorio/);
  assert.equal(repo.users.length, 0);
});

test('seed password authenticates and login response does not expose passwordHash', async () => {
  const repo = repository();
  await seed(repo).seed();
  const result = await new LoginUseCase(repo, { signAsync: async () => 'token' }, { get: key => key === 'JWT_EXPIRES_IN' ? '8h' : undefined }).execute({ identificacion: values.SEED_ADMIN_IDENTIFICACION, password: values.SEED_ADMIN_PASSWORD });
  assert.equal(result.usuario.passwordHash, undefined);
  assert.equal(result.usuario.password, undefined);
});
