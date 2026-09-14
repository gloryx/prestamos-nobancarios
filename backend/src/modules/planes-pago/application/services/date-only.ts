import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const isLeapYear = (year: number): boolean => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const isValidCalendarDate = (value: string): boolean => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
};

export const dateOnly = (value: Date | string): string => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new BadRequestException('Invalid payment date.');
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== 'string') throw new BadRequestException('Invalid payment date.');
  const result = value.slice(0, 10);
  if (!isValidCalendarDate(result)) throw new BadRequestException('Invalid payment date.');
  return result;
};
