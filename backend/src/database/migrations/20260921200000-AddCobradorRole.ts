import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCobradorRole20260921200000 implements MigrationInterface {
  name = 'AddCobradorRole20260921200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "usuario_rol_enum" ADD VALUE IF NOT EXISTS 'COBRADOR'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM "usuario" WHERE "rol" = 'COBRADOR'`);
    if (Number(count) > 0) throw new Error('Cannot remove COBRADOR while users still have that role.');
    await queryRunner.query(`ALTER TYPE "usuario_rol_enum" RENAME TO "usuario_rol_enum_old"`);
    await queryRunner.query(`CREATE TYPE "usuario_rol_enum" AS ENUM ('ADMINISTRADOR', 'VENDEDOR')`);
    await queryRunner.query(`ALTER TABLE "usuario" ALTER COLUMN "rol" TYPE "usuario_rol_enum" USING "rol"::text::"usuario_rol_enum"`);
    await queryRunner.query(`DROP TYPE "usuario_rol_enum_old"`);
  }
}
