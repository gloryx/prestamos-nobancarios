import { ApiProperty } from '@nestjs/swagger';

export class UsuarioSelectorResponseDto {
  @ApiProperty({ example: 7 }) id!: number;
  @ApiProperty({ example: 'Ana Pérez' }) nombreCompleto!: string;
}
