import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractualOriginEndDateToRefinanciamientos20260908190000 implements MigrationInterface {
  name = 'AddContractualOriginEndDateToRefinanciamientos20260908190000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "refinanciamiento" ADD "fecha_limite_contractual_origen" date');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "refinanciamiento" DROP COLUMN "fecha_limite_contractual_origen"');
  }
}
