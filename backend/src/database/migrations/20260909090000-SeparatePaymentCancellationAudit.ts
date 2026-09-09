import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparatePaymentCancellationAudit20260909090000 implements MigrationInterface {
  name = 'SeparatePaymentCancellationAudit20260909090000';

  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE "pago_anulacion" ("id" SERIAL NOT NULL, "pago_id" integer NOT NULL, "fecha" date NOT NULL, "usuario_id" integer NOT NULL, "motivo" "pago_motivo_anulacion_enum" NOT NULL, "observacion" text, "fecha_creacion" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_pago_anulacion_pago_id" UNIQUE ("pago_id"), CONSTRAINT "PK_pago_anulacion" PRIMARY KEY ("id"))`);
    await q.query(`ALTER TABLE "pago_anulacion" ADD CONSTRAINT "FK_pago_anulacion_pago" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE RESTRICT`);
    await q.query(`ALTER TABLE "pago_anulacion" ADD CONSTRAINT "FK_pago_anulacion_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT`);
    await q.query(`INSERT INTO "pago_anulacion" ("pago_id", "fecha", "usuario_id", "motivo", "observacion") SELECT "id", ("fecha_anulacion")::date, "usuario_anulacion_id", "motivo_anulacion", "observacion_anulacion" FROM "pago" WHERE "estado" = 'ANULADO' AND "fecha_anulacion" IS NOT NULL AND "usuario_anulacion_id" IS NOT NULL AND "motivo_anulacion" IS NOT NULL`);
    await q.query(`ALTER TABLE "pago" DROP CONSTRAINT "FK_pago_usuario_anulacion"`);
    await q.query(`ALTER TABLE "pago" DROP COLUMN "observacion_anulacion", DROP COLUMN "motivo_anulacion", DROP COLUMN "usuario_anulacion_id", DROP COLUMN "fecha_anulacion"`);
  }

  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE "pago" ADD "fecha_anulacion" timestamp, ADD "usuario_anulacion_id" integer, ADD "motivo_anulacion" "pago_motivo_anulacion_enum", ADD "observacion_anulacion" text`);
    await q.query(`ALTER TABLE "pago" ADD CONSTRAINT "FK_pago_usuario_anulacion" FOREIGN KEY ("usuario_anulacion_id") REFERENCES "usuario"("id") ON DELETE RESTRICT`);
    await q.query(`UPDATE "pago" p SET "fecha_anulacion" = a."fecha", "usuario_anulacion_id" = a."usuario_id", "motivo_anulacion" = a."motivo", "observacion_anulacion" = a."observacion" FROM "pago_anulacion" a WHERE a."pago_id" = p."id"`);
    await q.query(`ALTER TABLE "pago_anulacion" DROP CONSTRAINT "FK_pago_anulacion_usuario"`);
    await q.query(`ALTER TABLE "pago_anulacion" DROP CONSTRAINT "FK_pago_anulacion_pago"`);
    await q.query(`DROP TABLE "pago_anulacion"`);
  }
}
