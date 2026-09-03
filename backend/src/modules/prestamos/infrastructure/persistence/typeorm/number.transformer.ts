import { ValueTransformer } from 'typeorm';
export const numberTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};
