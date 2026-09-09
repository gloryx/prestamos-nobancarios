import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePaymentRedistributionNullable20260908210000 implements MigrationInterface {
  name = 'MakePaymentRedistributionNullable20260908210000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "pago" ALTER COLUMN "redistribuyo_plan" DROP DEFAULT');
    await queryRunner.query('ALTER TABLE "pago" ALTER COLUMN "redistribuyo_plan" DROP NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('UPDATE "pago" SET "redistribuyo_plan" = false WHERE "redistribuyo_plan" IS NULL');
    await queryRunner.query('ALTER TABLE "pago" ALTER COLUMN "redistribuyo_plan" SET DEFAULT false');
    await queryRunner.query('ALTER TABLE "pago" ALTER COLUMN "redistribuyo_plan" SET NOT NULL');
  }
}
