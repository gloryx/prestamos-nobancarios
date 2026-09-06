import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActualizarClienteUseCase } from './application/use-cases/actualizar-cliente.use-case';
import { CambiarEstadoClienteUseCase } from './application/use-cases/cambiar-estado-cliente.use-case';
import { CrearClienteUseCase } from './application/use-cases/crear-cliente.use-case';
import { ListarClientesUseCase } from './application/use-cases/listar-clientes.use-case';
import { ObtenerClienteUseCase } from './application/use-cases/obtener-cliente.use-case';
import { CLIENTE_REPOSITORY } from './domain/repositories/cliente.repository';
import { ClienteTypeOrmRepository } from './infrastructure/persistence/typeorm/cliente.typeorm-repository';
import { ClienteOrmEntity } from './infrastructure/persistence/typeorm/cliente.orm-entity';
import { ClientesController } from './presentation/controllers/clientes.controller';
import { ClienteIdentificacionStorageService } from './infrastructure/storage/cliente-identificacion-storage.service';
import { ClienteFichaPdfService } from './infrastructure/reports/cliente-ficha-pdf.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClienteOrmEntity])],
  controllers: [ClientesController],
  providers: [CrearClienteUseCase, ListarClientesUseCase, ObtenerClienteUseCase, ActualizarClienteUseCase, CambiarEstadoClienteUseCase, ClienteIdentificacionStorageService, ClienteFichaPdfService, { provide: CLIENTE_REPOSITORY, useClass: ClienteTypeOrmRepository }],
  exports: [CLIENTE_REPOSITORY],
})
export class ClientesModule {}
