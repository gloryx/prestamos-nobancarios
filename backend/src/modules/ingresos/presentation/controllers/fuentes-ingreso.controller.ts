import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';
import { ActualizarFuenteIngresoDto, CambiarEstadoFuenteIngresoDto, CrearFuenteIngresoDto, FiltrosFuentesIngresoDto } from '../../application/dto/fuente-ingreso.dto';
import { ActualizarFuenteIngresoUseCase, CambiarEstadoFuenteIngresoUseCase, CrearFuenteIngresoUseCase, ListarFuentesIngresoUseCase, ObtenerFuenteIngresoUseCase } from '../../application/use-cases/fuente-ingreso.use-cases';

@ApiTags('Fuentes de ingreso')
@ApiBearerAuth()
@Controller('fuentes-ingreso')
export class FuentesIngresoController {
  constructor(private crear: CrearFuenteIngresoUseCase, private listar: ListarFuentesIngresoUseCase, private obtener: ObtenerFuenteIngresoUseCase, private actualizar: ActualizarFuenteIngresoUseCase, private estado: CambiarEstadoFuenteIngresoUseCase) {}
  @Post() @Roles(RolUsuario.ADMINISTRADOR) @ApiBody({ type: CrearFuenteIngresoDto }) crearFuente(@Body() dto: CrearFuenteIngresoDto) { return this.crear.execute(dto.nombre); }
  @Get() @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR) listarFuentes(@Query() dto: FiltrosFuentesIngresoDto) { return this.listar.execute(dto.activo); }
  @Get(':id') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR) obtenerFuente(@Param('id', ParseIntPipe) id: number) { return this.obtener.execute(id); }
  @Put(':id') @Roles(RolUsuario.ADMINISTRADOR) @ApiBody({ type: ActualizarFuenteIngresoDto }) actualizarFuente(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarFuenteIngresoDto) { return this.actualizar.execute(id, dto.nombre); }
  @Patch(':id/estado') @Roles(RolUsuario.ADMINISTRADOR) @ApiBody({ type: CambiarEstadoFuenteIngresoDto }) cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoFuenteIngresoDto) { return this.estado.execute(id, dto.activo); }
}
