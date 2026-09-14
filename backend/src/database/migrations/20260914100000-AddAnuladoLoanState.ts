import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnuladoLoanState20260914100000 implements MigrationInterface {
  name = 'AddAnuladoLoanState20260914100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "prestamo_estado_enum" ADD VALUE IF NOT EXISTS 'ANULADO'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error('La eliminación de ANULADO requiere una migración explícita y no destructiva.');
  }
}
