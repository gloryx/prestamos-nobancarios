import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPuestaMarchaFinanciera20260918160000 implements MigrationInterface {
  name = 'AddPuestaMarchaFinanciera20260918160000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "puesta_marcha_financiera_modalidad_enum" AS ENUM ('NEGOCIO_NUEVO', 'HISTORICO_COMPLETO', 'MIGRACION_SALDOS')`);
    await queryRunner.query(`CREATE TYPE "puesta_marcha_financiera_concepto_enum" AS ENUM ('DISPONIBLE', 'CARTERA_TOTAL', 'CARTERA_ACTIVA', 'CARTERA_INCOBRABLE')`);
    await queryRunner.query(`CREATE TYPE "puesta_marcha_financiera_procedencia_enum" AS ENUM ('RECONSTRUIDO', 'DECLARADO', 'NO_APLICA')`);
    await queryRunner.query(`CREATE TABLE "puesta_marcha_financiera" ("id" SERIAL NOT NULL, "configuracion_financiera_id" integer NOT NULL, "fecha_base" date NOT NULL, "fecha_inicio_cierres" date NOT NULL, "modalidad" "puesta_marcha_financiera_modalidad_enum" NOT NULL, "usuario_confirmacion_id" integer NOT NULL, "fecha_confirmacion" timestamp NOT NULL, "observaciones" text, "fecha_creacion" timestamp NOT NULL DEFAULT now(), CONSTRAINT "PK_puesta_marcha_financiera_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_puesta_marcha_financiera_configuracion" UNIQUE ("configuracion_financiera_id"), CONSTRAINT "CHK_puesta_marcha_financiera_fechas" CHECK ("fecha_base" < "fecha_inicio_cierres"))`);
    await queryRunner.query(`CREATE TABLE "puesta_marcha_financiera_saldo" ("id" SERIAL NOT NULL, "puesta_marcha_id" integer NOT NULL, "concepto" "puesta_marcha_financiera_concepto_enum" NOT NULL, "monto" numeric(14,2) NOT NULL, "procedencia" "puesta_marcha_financiera_procedencia_enum" NOT NULL, "evidencia" text, "observacion" text, CONSTRAINT "PK_puesta_marcha_financiera_saldo_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_puesta_marcha_financiera_saldo_concepto" UNIQUE ("puesta_marcha_id", "concepto"), CONSTRAINT "CHK_puesta_marcha_financiera_saldo_monto" CHECK ("monto" >= 0))`);
    await queryRunner.query(`ALTER TABLE "puesta_marcha_financiera" ADD CONSTRAINT "FK_puesta_marcha_financiera_configuracion" FOREIGN KEY ("configuracion_financiera_id") REFERENCES "configuracion_financiera"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "puesta_marcha_financiera" ADD CONSTRAINT "FK_puesta_marcha_financiera_usuario" FOREIGN KEY ("usuario_confirmacion_id") REFERENCES "usuario"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "puesta_marcha_financiera_saldo" ADD CONSTRAINT "FK_puesta_marcha_financiera_saldo_puesta" FOREIGN KEY ("puesta_marcha_id") REFERENCES "puesta_marcha_financiera"("id") ON DELETE RESTRICT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "puesta_marcha_financiera_saldo"`);
    await queryRunner.query(`DROP TABLE "puesta_marcha_financiera"`);
    await queryRunner.query(`DROP TYPE "puesta_marcha_financiera_procedencia_enum"`);
    await queryRunner.query(`DROP TYPE "puesta_marcha_financiera_concepto_enum"`);
    await queryRunner.query(`DROP TYPE "puesta_marcha_financiera_modalidad_enum"`);
  }
}
