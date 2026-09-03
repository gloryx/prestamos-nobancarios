import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ActualizarFormaPagoDto } from '../../application/dto/actualizar-forma-pago.dto';
import { CambiarEstadoFormaPagoDto } from '../../application/dto/cambiar-estado-forma-pago.dto';
import { CrearFormaPagoDto } from '../../application/dto/crear-forma-pago.dto';
import { ActualizarFormaPagoUseCase } from '../../application/use-cases/actualizar-forma-pago.use-case';
import { CambiarEstadoFormaPagoUseCase } from '../../application/use-cases/cambiar-estado-forma-pago.use-case';
import { CrearFormaPagoUseCase } from '../../application/use-cases/crear-forma-pago.use-case';
import { ListarFormasPagoUseCase } from '../../application/use-cases/listar-formas-pago.use-case';
import { ObtenerFormaPagoUseCase } from '../../application/use-cases/obtener-forma-pago.use-case';
import { FormaPagoResponseDto } from '../dto/forma-pago-response.dto';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';

@ApiTags('Formas de pago')
@ApiBearerAuth()
@Controller('formas-pago')
export class FormasPagoController {
  constructor(
    private readonly crearFormaPagoUseCase: CrearFormaPagoUseCase,
    private readonly listarFormasPagoUseCase: ListarFormasPagoUseCase,
    private readonly obtenerFormaPagoUseCase: ObtenerFormaPagoUseCase,
    private readonly actualizarFormaPagoUseCase: ActualizarFormaPagoUseCase,
    private readonly cambiarEstadoFormaPagoUseCase: CambiarEstadoFormaPagoUseCase,
  ) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Crear una forma de pago',
    description: 'Registra una nueva forma de pago en el sistema.',
  })
  @ApiBody({
    type: CrearFormaPagoDto,
    schema: { type: 'object', example: { nombre: 'Sinpe Móvil' } },
  })
  @ApiResponse({
    status: 201,
    description: 'Forma de pago creada correctamente.',
    type: FormaPagoResponseDto,
    example: { id: 1, nombre: 'Sinpe Móvil', activo: true },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
    example: {
      statusCode: 400,
      message: ['nombre should not be empty'],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una forma de pago con ese nombre',
    example: {
      statusCode: 409,
      message: 'Ya existe una forma de pago con ese nombre.',
      error: 'Conflict',
    },
  })
  crear(@Body() dto: CrearFormaPagoDto) {
    return this.crearFormaPagoUseCase.execute(dto);
  }

  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({
    summary: 'Listar formas de pago',
    description: 'Obtiene todas las formas de pago registradas, incluyendo activas e inactivas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de formas de pago obtenido correctamente.',
    type: FormaPagoResponseDto,
    isArray: true,
    example: [
      { id: 1, nombre: 'Sinpe Móvil', activo: true },
      { id: 2, nombre: 'Efectivo', activo: true },
      { id: 3, nombre: 'Transferencia', activo: true },
      { id: 4, nombre: 'Otro', activo: false },
    ],
  })
  listar() {
    return this.listarFormasPagoUseCase.execute();
  }

  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({
    summary: 'Obtener una forma de pago',
    description: 'Obtiene una forma de pago registrada por su identificador.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la forma de pago',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Forma de pago obtenida correctamente.',
    type: FormaPagoResponseDto,
    example: { id: 1, nombre: 'Sinpe Móvil', activo: true },
  })
  @ApiResponse({
    status: 404,
    description: 'Forma de pago no encontrada.',
    example: {
      statusCode: 404,
      message: 'Forma de pago no encontrada.',
      error: 'Not Found',
    },
  })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.obtenerFormaPagoUseCase.execute(id);
  }

  @Put(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Actualizar una forma de pago',
    description: 'Modifica el nombre de una forma de pago existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la forma de pago',
    example: 1,
  })
  @ApiBody({
    type: ActualizarFormaPagoDto,
    schema: {
      type: 'object',
      example: { nombre: 'Transferencia bancaria' },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Forma de pago actualizada correctamente.',
    type: FormaPagoResponseDto,
    example: { id: 1, nombre: 'Transferencia bancaria', activo: true },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
    example: {
      statusCode: 400,
      message: ['nombre should not be empty'],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Forma de pago no encontrada.',
    example: {
      statusCode: 404,
      message: 'Forma de pago no encontrada.',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una forma de pago con ese nombre',
    example: {
      statusCode: 409,
      message: 'Ya existe una forma de pago con ese nombre.',
      error: 'Conflict',
    },
  })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarFormaPagoDto,
  ) {
    return this.actualizarFormaPagoUseCase.execute(id, dto);
  }

  @Patch(':id/estado')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Activar o desactivar una forma de pago',
    description: 'Permite cambiar el estado de una forma de pago sin eliminarla físicamente.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la forma de pago',
    example: 1,
  })
  @ApiBody({
    type: CambiarEstadoFormaPagoDto,
    description: 'Use false para desactivar o true para activar la forma de pago.',
    schema: { type: 'object', example: { activo: false } },
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de la forma de pago actualizado correctamente.',
    type: FormaPagoResponseDto,
    example: { id: 1, nombre: 'Sinpe Móvil', activo: false },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
    example: {
      statusCode: 400,
      message: ['activo must be a boolean value'],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Forma de pago no encontrada.',
    example: {
      statusCode: 404,
      message: 'Forma de pago no encontrada.',
      error: 'Not Found',
    },
  })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoFormaPagoDto,
  ) {
    return this.cambiarEstadoFormaPagoUseCase.execute(id, dto.activo);
  }
}
