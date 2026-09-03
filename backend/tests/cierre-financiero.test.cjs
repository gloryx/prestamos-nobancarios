const test = require('node:test');
const assert = require('node:assert/strict');
const { FinancialPeriodService } = require('../dist/modules/cierre-financiero/application/financial-period.service');
const { ConflictException, BadRequestException } = require('@nestjs/common');

test('financial period policy rejects dates before opening and closed periods', async () => {
  const service = new FinancialPeriodService();
  const configRepo = { findOne: async () => ({ fechaApertura: '2026-01-15' }) };
  const closedQuery = { where() { return this; }, getOne: async () => ({ id: 1 }) };
  const manager = { getRepository: entity => entity.name.includes('Configuracion') ? configRepo : {}, createQueryBuilder: () => closedQuery };
  await assert.rejects(() => service.assertOpen(manager, new Date('2026-01-14T00:00:00Z')), BadRequestException);
  await assert.rejects(() => service.assertOpen(manager, new Date('2026-02-01T00:00:00Z')), ConflictException);
});
