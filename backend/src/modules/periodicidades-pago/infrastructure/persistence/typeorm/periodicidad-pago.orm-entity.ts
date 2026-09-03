import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('periodicidad_pago')
export class PeriodicidadPagoOrmEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  nombre!: string;

  @Column({ type: 'boolean', default: true, nullable: false })
  activo!: boolean;
}
