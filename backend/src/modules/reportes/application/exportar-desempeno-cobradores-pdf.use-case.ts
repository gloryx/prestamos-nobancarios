import { Inject, Injectable } from '@nestjs/common';
import { DesempenoCobradoresUseCase } from './desempeno-cobradores.use-case';
import type { DesempenoCobradoresQueryDto } from './dto/desempeno-cobradores-query.dto';
import { DesempenoCobradoresPdfService } from '../infrastructure/desempeno-cobradores-pdf.service';
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../../usuarios/domain/repositories/usuario.repository';
import { FORMA_PAGO_REPOSITORY, type FormaPagoRepository } from '../../formas-pago/domain/repositories/forma-pago.repository';

@Injectable()
export class ExportarDesempenoCobradoresPdfUseCase {
  constructor(
    private readonly reporte: DesempenoCobradoresUseCase,
    private readonly pdf: DesempenoCobradoresPdfService,
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(FORMA_PAGO_REPOSITORY) private readonly formasPago: FormaPagoRepository,
  ) {}

  async execute(query: DesempenoCobradoresQueryDto): Promise<Buffer> {
    const report = await this.reporte.execute(query);
    const [cobradorNombre, formaPagoNombre] = await Promise.all([
      this.resolveLabel(query.cobradorId, (id) => this.usuarios.buscarPorId(id), 'Cobrador'),
      this.resolveLabel(query.formaPagoId, (id) => this.formasPago.buscarPorId(id), 'Forma de pago'),
    ]);
    return this.pdf.generar(report, query, { cobradorNombre, formaPagoNombre });
  }

  private async resolveLabel<T extends { id: number | null }>(id: number | undefined, lookup: (id: number) => Promise<T | null>, kind: string): Promise<string | undefined> {
    if (id === undefined) return undefined;
    try {
      const entity = await lookup(id);
      const name = entity && ('nombreCompleto' in entity ? entity.nombreCompleto : 'nombre' in entity ? entity.nombre : undefined);
      return typeof name === 'string' && name.trim() ? name : `${kind} ID ${id}`;
    } catch {
      return `${kind} ID ${id}`;
    }
  }
}
