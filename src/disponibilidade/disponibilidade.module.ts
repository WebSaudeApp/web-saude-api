import { Module } from '@nestjs/common';
import { DisponibilidadeController } from './disponibilidade.controller';
import { BuscaModule } from '../busca/busca.module';

@Module({
  imports: [BuscaModule],
  controllers: [DisponibilidadeController],
})
export class DisponibilidadeModule {}
