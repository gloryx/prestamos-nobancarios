import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisbursementPaymentMethods20260904180000 implements MigrationInterface {
  name = 'AddDisbursementPaymentMethods20260904180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "prestamo" ADD "forma_desembolso_id" integer`);
    await queryRunner.query(`ALTER TABLE "movimiento_caja" ADD "forma_pago_id" integer`);
    await queryRunner.query(`ALTER TABLE "prestamo" ADD CONSTRAINT "FK_prestamo_forma_desembolso" FOREIGN KEY ("forma_desembolso_id") REFERENCES "forma_pago"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "movimiento_caja" ADD CONSTRAINT "FK_movimiento_forma_pago" FOREIGN KEY ("forma_pago_id") REFERENCES "forma_pago"("id") ON DELETE RESTRICT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "movimiento_caja" DROP CONSTRAINT "FK_movimiento_forma_pago"`);
    await queryRunner.query(`ALTER TABLE "prestamo" DROP CONSTRAINT "FK_prestamo_forma_desembolso"`);
    await queryRunner.query(`ALTER TABLE "movimiento_caja" DROP COLUMN "forma_pago_id"`);
    await queryRunner.query(`ALTER TABLE "prestamo" DROP COLUMN "forma_desembolso_id"`);
  }
}
