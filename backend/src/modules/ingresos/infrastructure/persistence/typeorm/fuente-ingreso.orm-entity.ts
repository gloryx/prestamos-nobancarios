import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('fuente_ingreso') @Index('UQ_fuente_ingreso_nombre', ['nombre'], { unique: true })
export class FuenteIngresoOrmEntity { @PrimaryGeneratedColumn() id!: number; @Column({ type: 'varchar', length: 120 }) nombre!: string; @Column({ type: 'boolean', default: true }) activo!: boolean; @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date; }
