import { Inject, Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { DatosPrestamo } from '../../domain/entities/prestamo';
import { PRESTAMO_REPOSITORY, PrestamoConRelaciones, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { ActualizarPrestamoDto } from '../dto/actualizar-prestamo.dto';
import { PrestamoReferences } from './prestamo-references';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
import { PAGO_REPOSITORY, PagoRepository } from '../../../pagos/domain/repositories/pago.repository';

const has = (dto: ActualizarPrestamoDto, key: keyof ActualizarPrestamoDto): boolean => Object.prototype.hasOwnProperty.call(dto, key);
const moneyInCents = (value: number): number => Math.round(value * 100);
const dateOnly = (value: Date): string => value.toISOString().slice(0, 10);
const REFINANCED_UPDATE_MESSAGE = 'Un préstamo refinanciado no permite modificar datos contractuales o financieros. Solo puede actualizarse la observación.';

@Injectable()
export class ActualizarPrestamoUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, private readonly references: PrestamoReferences, @Optional() @Inject(PAGO_REPOSITORY) private readonly pagos?: PagoRepository) {}
  async execute(id: number, dto: ActualizarPrestamoDto): Promise<PrestamoConRelaciones> {
    const prestamo = await this.repository.buscarPorId(id);
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    if (prestamo.estado === EstadoPrestamo.CANCELADO) throw new BadRequestException('Un préstamo cancelado no puede modificarse.');
    if (prestamo.estado === EstadoPrestamo.ANULADO) throw new BadRequestException('Un préstamo anulado no puede modificarse.');
    if (prestamo.estado === EstadoPrestamo.REFINANCIADO) {
      const contractualChange = (has(dto, 'clienteId') && dto.clienteId !== prestamo.clienteId)
        || (has(dto, 'fechaAlta') && dto.fechaAlta!.slice(0, 10) !== dateOnly(prestamo.fechaAlta))
        || (has(dto, 'capital') && moneyInCents(dto.capital!) !== moneyInCents(prestamo.capital))
        || (has(dto, 'interes') && moneyInCents(dto.interes!) !== moneyInCents(prestamo.interes))
        || (has(dto, 'periodicidadPagoId') && dto.periodicidadPagoId !== prestamo.periodicidadPagoId)
        || (has(dto, 'cantidadPagos') && dto.cantidadPagos !== prestamo.cantidadPagos)
        || (has(dto, 'formaPagoId') && dto.formaPagoId !== prestamo.formaPagoId)
        || (has(dto, 'formaDesembolsoId') && dto.formaDesembolsoId !== prestamo.formaDesembolsoId)
        || (has(dto, 'planPersonalizado') && dto.planPersonalizado !== prestamo.planPersonalizado)
        || has(dto, 'cuotas');
      if (contractualChange) throw new BadRequestException(REFINANCED_UPDATE_MESSAGE);
      const datosHistoricos: DatosPrestamo = {
        clienteId: prestamo.clienteId, periodicidadPagoId: prestamo.periodicidadPagoId,
        formaPagoId: prestamo.formaPagoId, formaDesembolsoId: prestamo.formaDesembolsoId,
        fechaAlta: prestamo.fechaAlta, capital: prestamo.capital, interes: prestamo.interes,
        cantidadPagos: prestamo.cantidadPagos, planPersonalizado: prestamo.planPersonalizado,
        observaciones: has(dto, 'observaciones') ? dto.observaciones : prestamo.observaciones,
      };
      prestamo.actualizarDatos(datosHistoricos);
      return this.repository.actualizar(prestamo);
    }
    const datos: DatosPrestamo = {
      clienteId: dto.clienteId ?? prestamo.clienteId, periodicidadPagoId: dto.periodicidadPagoId ?? prestamo.periodicidadPagoId,
      formaPagoId: dto.formaPagoId ?? prestamo.formaPagoId, fechaAlta: has(dto, 'fechaAlta') ? new Date(`${dto.fechaAlta!.slice(0, 10)}T00:00:00.000Z`) : prestamo.fechaAlta,
      formaDesembolsoId: has(dto, 'formaDesembolsoId') ? dto.formaDesembolsoId! : prestamo.formaDesembolsoId,
      capital: dto.capital ?? prestamo.capital, interes: dto.interes ?? prestamo.interes, cantidadPagos: dto.cantidadPagos ?? prestamo.cantidadPagos,
      planPersonalizado: dto.planPersonalizado ?? prestamo.planPersonalizado, observaciones: has(dto, 'observaciones') ? dto.observaciones : prestamo.observaciones,
    };
    await this.references.validar(datos.clienteId, datos.periodicidadPagoId, datos.formaPagoId, has(dto, 'formaDesembolsoId') ? dto.formaDesembolsoId : undefined);
    const totales = this.pagos ? await this.pagos.obtenerTotalesPorPrestamo(id) : { capital: 0, interes: 0, total: 0 };
    if (datos.capital < totales.capital) throw new BadRequestException('El capital del préstamo no puede ser menor al capital ya pagado.');
    if (datos.interes < totales.interes) throw new BadRequestException('El interés del préstamo no puede ser menor al interés ya pagado.');
    prestamo.actualizarDatos(datos);
    return this.repository.actualizar(prestamo);
  }
}
