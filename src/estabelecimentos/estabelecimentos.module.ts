import { Module } from '@nestjs/common';
import { BuscaModule } from '../busca/busca.module';
import { EstabelecimentosController } from './estabelecimentos.controller';
import { EstabelecimentosService } from './estabelecimentos.service';
import { MidiasController } from './midias.controller';

@Module({
  imports: [BuscaModule],
  controllers: [EstabelecimentosController, MidiasController],
  providers: [EstabelecimentosService],
  exports: [EstabelecimentosService],
})
export class EstabelecimentosModule {}
