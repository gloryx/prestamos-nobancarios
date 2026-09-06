import { Body, Controller, Get, InternalServerErrorException, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActualizarUsuarioDto } from '../../application/dto/actualizar-usuario.dto';
import { CambiarEstadoUsuarioDto } from '../../application/dto/cambiar-estado-usuario.dto';
import { CrearUsuarioDto } from '../../application/dto/crear-usuario.dto';
import { FiltrosUsuariosDto } from '../../application/dto/filtros-usuarios.dto';
import { ActualizarUsuarioUseCase } from '../../application/use-cases/actualizar-usuario.use-case';
import { CambiarEstadoUsuarioUseCase } from '../../application/use-cases/cambiar-estado-usuario.use-case';
import { CrearUsuarioUseCase } from '../../application/use-cases/crear-usuario.use-case';
import { ListarUsuariosUseCase } from '../../application/use-cases/listar-usuarios.use-case';
import { ListarUsuariosSelectorUseCase } from '../../application/use-cases/listar-usuarios-selector.use-case';
import { ObtenerUsuarioUseCase } from '../../application/use-cases/obtener-usuario.use-case';
import { Usuario } from '../../domain/entities/usuario';
import { RolUsuario } from '../../domain/enums/rol-usuario.enum';
import { UsuarioResponseDto } from '../dto/usuario-response.dto';
import { UsuariosPaginadosResponseDto } from '../dto/usuarios-paginados-response.dto';
import { UsuarioSelectorResponseDto } from '../dto/usuario-selector-response.dto';
import { CambiarPasswordDto } from '../../application/dto/cambiar-password.dto';
import { CambiarPasswordUsuarioUseCase } from '../../application/use-cases/cambiar-password-usuario.use-case';
import { Roles } from '../../../auth/auth.decorators';

const response = (usuario: Usuario): UsuarioResponseDto => {
  if (usuario.id === null) throw new InternalServerErrorException('El usuario persistido no tiene identificación.');
  return { id: usuario.id, identificacion: usuario.identificacion, nombreCompleto: usuario.nombreCompleto, telefono: usuario.telefono, correo: usuario.correo, rol: usuario.rol, fechaCreacion: usuario.fechaCreacion, fechaActualizacion: usuario.fechaActualizacion, activo: usuario.activo };
};

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
@Roles(RolUsuario.ADMINISTRADOR)
export class UsuariosController {
  constructor(private readonly crear: CrearUsuarioUseCase, private readonly listarUseCase: ListarUsuariosUseCase, private readonly listarSelectorUseCase: ListarUsuariosSelectorUseCase, private readonly obtenerUseCase: ObtenerUsuarioUseCase, private readonly actualizarUseCase: ActualizarUsuarioUseCase, private readonly estadoUseCase: CambiarEstadoUsuarioUseCase, private readonly passwordUseCase: CambiarPasswordUsuarioUseCase) {}
  @Post()
  @ApiOperation({ summary: 'Crear un usuario', description: 'Registra un usuario y almacena la contraseña únicamente como hash.' })
  @ApiBody({ type: CrearUsuarioDto })
  @ApiResponse({ status: 201, description: 'Usuario creado correctamente.', type: UsuarioResponseDto })
  @ApiResponse({ status: 409, description: 'La identificación ya está registrada.' })
  crearUsuario(@Body() dto: CrearUsuarioDto) { return this.crear.execute(dto).then(response); }
  @Get()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Listar usuarios', description: 'Obtiene usuarios con búsqueda, filtros y paginación.' })
  @ApiQuery({ name: 'pagina', required: false, type: Number, default: 1 }) @ApiQuery({ name: 'limite', required: false, type: Number, default: 10, maximum: 100 }) @ApiQuery({ name: 'buscar', required: false }) @ApiQuery({ name: 'activo', required: false, type: Boolean }) @ApiQuery({ name: 'rol', required: false, enum: RolUsuario })
  @ApiResponse({ status: 200, type: UsuariosPaginadosResponseDto })
  async listar(@Query() dto: FiltrosUsuariosDto) { const result = await this.listarUseCase.execute(dto); return { ...result, datos: result.datos.map(response) }; }
  @Get('selector')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Listar usuarios activos para selectores' })
  @ApiResponse({ status: 200, type: UsuarioSelectorResponseDto, isArray: true })
  listarSelector() { return this.listarSelectorUseCase.execute(); }
  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Obtener un usuario' }) @ApiParam({ name: 'id', example: 1 }) @ApiResponse({ status: 200, type: UsuarioResponseDto }) @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  async obtener(@Param('id', ParseIntPipe) id: number) { return response(await this.obtenerUseCase.execute(id)); }
  @Put(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar datos generales de un usuario', description: 'La contraseña no se acepta en esta operación.' }) @ApiParam({ name: 'id', example: 1 }) @ApiBody({ type: ActualizarUsuarioDto }) @ApiResponse({ status: 200, type: UsuarioResponseDto }) @ApiResponse({ status: 404, description: 'Usuario no encontrado.' }) @ApiResponse({ status: 409, description: 'La identificación ya está registrada.' })
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarUsuarioDto) { return response(await this.actualizarUseCase.execute(id, dto)); }
  @Patch(':id/estado')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Activar o desactivar un usuario' }) @ApiParam({ name: 'id', example: 1 }) @ApiBody({ type: CambiarEstadoUsuarioDto }) @ApiResponse({ status: 200, type: UsuarioResponseDto }) @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  async cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoUsuarioDto) { return response(await this.estadoUseCase.execute(id, dto.activo)); }
  @Patch(':id/password')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Cambiar contraseña de usuario' }) @ApiBody({ type: CambiarPasswordDto })
  async cambiarPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarPasswordDto) { return response(await this.passwordUseCase.execute(id, dto.password)); }
}
