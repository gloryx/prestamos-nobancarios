import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('forma_pago')
export class FormaPagoOrmEntity {
  @PrimaryGeneratedColumn('identity', { type: 'smallint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  nombre!: string;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;
}
