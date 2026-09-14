const assert = require('node:assert/strict');
const test = require('node:test');
require('reflect-metadata');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { CuotaPlanPagoPersonalizacionDto } = require('../dist/modules/planes-pago/application/dto/cuota-plan-pago.dto');

const validQuota = (id) => ({ ...(id === undefined ? {} : { id }), fechaVencimiento: '2026-10-03', montoProgramado: 100 });
const validationErrors = async (value) => validate(plainToInstance(CuotaPlanPagoPersonalizacionDto, value));

test('accepts a missing id for a new installment', async () => {
  assert.equal((await validationErrors(validQuota(undefined))).length, 0);
});

test('accepts an integer positive id for an existing installment', async () => {
  const quota = plainToInstance(CuotaPlanPagoPersonalizacionDto, validQuota('7'));
  assert.equal(quota.id, 7);
  assert.equal((await validate(quota)).length, 0);
});

test('rejects invalid ids while preserving numeric transformation', async () => {
  for (const id of ['', 0, -1, 1.5]) {
    const errors = await validationErrors({ ...validQuota(id), id });
    assert.ok(errors.some((error) => error.property === 'id'), `Expected id=${JSON.stringify(id)} to be invalid`);
  }
});
