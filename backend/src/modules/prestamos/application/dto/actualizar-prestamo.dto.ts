import { PartialType } from '@nestjs/swagger';
import { CrearPrestamoDto } from './crear-prestamo.dto';
export class ActualizarPrestamoDto extends PartialType(CrearPrestamoDto) {}
