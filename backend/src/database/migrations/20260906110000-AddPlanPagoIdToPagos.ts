import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanPagoIdToPagos20260906110000 implements MigrationInterface {
  name = 'AddPlanPagoIdToPagos20260906110000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pago" ADD "plan_pago_id" integer`);
    await queryRunner.query(`ALTER TABLE "pago" ADD CONSTRAINT "FK_pago_plan_pago" FOREIGN KEY ("plan_pago_id") REFERENCES "plan_pago"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE INDEX "IDX_pago_plan_pago" ON "pago" ("plan_pago_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_pago_plan_pago"`);
    await queryRunner.query(`ALTER TABLE "pago" DROP CONSTRAINT "FK_pago_plan_pago"`);
    await queryRunner.query(`ALTER TABLE "pago" DROP COLUMN "plan_pago_id"`);
  }
}
