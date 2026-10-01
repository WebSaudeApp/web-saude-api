import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { EspecialidadesModule } from '../especialidades/especialidades.module';
import { EstabelecimentosController } from './estabelecimentos.controller';
import { EstabelecimentosService } from './estabelecimentos.service';
import { MidiasController } from './midias.controller';

@Module({
  imports: [EspecialidadesModule, ReviewsModule],
  controllers: [EstabelecimentosController, MidiasController],
  providers: [EstabelecimentosService],
  exports: [EstabelecimentosService],
})
export class EstabelecimentosModule {}
