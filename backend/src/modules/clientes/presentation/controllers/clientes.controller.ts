import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActualizarClienteDto } from '../../application/dto/actualizar-cliente.dto';
import { CambiarEstadoClienteDto } from '../../application/dto/cambiar-estado-cliente.dto';
import { CrearClienteDto } from '../../application/dto/crear-cliente.dto';
import { FiltrosClientesDto } from '../../application/dto/filtros-clientes.dto';
import { ActualizarClienteUseCase } from '../../application/use-cases/actualizar-cliente.use-case';
import { CambiarEstadoClienteUseCase } from '../../application/use-cases/cambiar-estado-cliente.use-case';
import { CrearClienteUseCase } from '../../application/use-cases/crear-cliente.use-case';
import { ListarClientesUseCase } from '../../application/use-cases/listar-clientes.use-case';
import { ObtenerClienteUseCase } from '../../application/use-cases/obtener-cliente.use-case';
import { Cliente } from '../../domain/entities/cliente';
import { Genero } from '../../domain/enums/genero.enum';
import { Nacionalidad } from '../../domain/enums/nacionalidad.enum';
import { ClienteResponseDto } from '../dto/cliente-response.dto';
import { ClientesPaginadosResponseDto } from '../dto/clientes-paginados-response.dto';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';

const response = (cliente: Cliente): ClienteResponseDto => ({ ...cliente, id: cliente.id!, fechaNacimiento: cliente.fechaNacimiento?.toISOString().slice(0, 10) ?? null });

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly crear: CrearClienteUseCase, private readonly listarUseCase: ListarClientesUseCase, private readonly obtenerUseCase: ObtenerClienteUseCase, private readonly actualizarUseCase: ActualizarClienteUseCase, private readonly estadoUseCase: CambiarEstadoClienteUseCase) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Crear un cliente', description: 'Registra un nuevo cliente en el sistema.' })
  @ApiBody({ type: CrearClienteDto, description: 'Datos completos del cliente.', schema: { type: 'object', example: { identificacion: '1-1111-1111', primerNombre: 'Ana', segundoNombre: 'María', primerApellido: 'Pérez', segundoApellido: 'Mora', genero: Genero.FEMENINO, fechaNacimiento: '1990-05-15', direccion: 'San José, Costa Rica', correo: 'Ana.Perez@example.com', telefono1: '8888-8888', telefono2: '2222-2222', nacionalidad: Nacionalidad.COSTARRICENSE, observaciones: 'Cliente recomendado', urlIdentificacion: '/uploads/clientes/identificaciones/AnaPerez.jpg' } } })
  @ApiResponse({ status: 201, description: 'Cliente creado correctamente.', type: ClienteResponseDto, example: { id: 1, identificacion: '1-1111-1111', primerNombre: 'ANA', segundoNombre: 'MARÍA', primerApellido: 'PÉREZ', segundoApellido: 'MORA', genero: Genero.FEMENINO, fechaNacimiento: '1990-05-15', direccion: 'SAN JOSÉ, COSTA RICA', correo: 'ana.perez@example.com', telefono1: '8888-8888', telefono2: '2222-2222', nacionalidad: Nacionalidad.COSTARRICENSE, observaciones: 'CLIENTE RECOMENDADO', fechaIngreso: '2026-08-30T12:00:00.000Z', urlIdentificacion: '/uploads/clientes/identificaciones/AnaPerez.jpg', activo: true } })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 409, description: 'La identificación ya está registrada.', example: { statusCode: 409, message: 'Ya existe un cliente con esa identificación.', error: 'Conflict' } })
  async crearCliente(@Body() dto: CrearClienteDto) { return response(await this.crear.execute(dto)); }

  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Listar clientes', description: 'Obtiene los clientes registrados con búsqueda, filtros y paginación.' })
  @ApiQuery({ name: 'pagina', required: false, type: Number, example: 1, default: 1, minimum: 1, description: 'Número de página.' }) @ApiQuery({ name: 'limite', required: false, type: Number, example: 10, default: 10, minimum: 1, maximum: 100, description: 'Cantidad de registros por página.' })
  @ApiQuery({ name: 'buscar', required: false, example: 'perez' }) @ApiQuery({ name: 'activo', required: false, example: true, type: Boolean })
  @ApiResponse({ status: 200, description: 'Listado obtenido correctamente.', type: ClientesPaginadosResponseDto })
  async listar(@Query() dto: FiltrosClientesDto) { const result = await this.listarUseCase.execute(dto); return { ...result, datos: result.datos.map(response) }; }

  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Obtener un cliente', description: 'Obtiene un cliente por su identificador.' }) @ApiParam({ name: 'id', description: 'Identificador del cliente', example: 1 })
  @ApiResponse({ status: 200, description: 'Cliente obtenido correctamente.', type: ClienteResponseDto }) @ApiResponse({ status: 404, description: 'Cliente no encontrado.', example: { statusCode: 404, message: 'Cliente no encontrado.', error: 'Not Found' } })
  async obtener(@Param('id', ParseIntPipe) id: number) { return response(await this.obtenerUseCase.execute(id)); }

  @Put(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Actualizar un cliente', description: 'Actualiza los datos generales de un cliente existente.' }) @ApiParam({ name: 'id', description: 'Identificador del cliente', example: 1 }) @ApiBody({ type: ActualizarClienteDto, schema: { type: 'object', example: { genero: Genero.MASCULINO } } })
  @ApiResponse({ status: 200, description: 'Cliente actualizado correctamente.', type: ClienteResponseDto }) @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' }) @ApiResponse({ status: 404, description: 'Cliente no encontrado.' }) @ApiResponse({ status: 409, description: 'La identificación ya está registrada.' })
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarClienteDto) { return response(await this.actualizarUseCase.execute(id, dto)); }

  @Patch(':id/estado')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Activar o desactivar un cliente', description: 'Cambia el estado del cliente sin eliminar su información histórica.' }) @ApiParam({ name: 'id', description: 'Identificador del cliente', example: 1 }) @ApiBody({ type: CambiarEstadoClienteDto, schema: { example: { activo: false } } })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente.', type: ClienteResponseDto }) @ApiResponse({ status: 400, description: 'El estado debe ser booleano.' }) @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  async cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoClienteDto) { return response(await this.estadoUseCase.execute(id, dto.activo)); }
}
