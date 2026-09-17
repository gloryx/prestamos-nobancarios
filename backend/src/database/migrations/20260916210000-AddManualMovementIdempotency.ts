import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualMovementIdempotency20260916210000 implements MigrationInterface {
  name = 'AddManualMovementIdempotency20260916210000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "movimiento_caja" ADD "idempotency_key" varchar(128)');
    await queryRunner.query('ALTER TABLE "movimiento_caja" ADD "idempotency_fingerprint" text');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_movimiento_caja_idempotency" ON "movimiento_caja" ("usuario_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_movimiento_caja_idempotency"');
    await queryRunner.query('ALTER TABLE "movimiento_caja" DROP COLUMN "idempotency_fingerprint"');
    await queryRunner.query('ALTER TABLE "movimiento_caja" DROP COLUMN "idempotency_key"');
  }
}
