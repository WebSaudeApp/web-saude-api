import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { BuscaService } from '../busca.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const buscaService = app.get(BuscaService);
    console.log('Verificando conexão com o Elasticsearch...');
    const online = await buscaService.estaDisponivel();
    if (!online) {
      console.error('Elasticsearch não está acessível.');
      process.exit(1);
    }

    console.log('Inicializando índice e alias de estabelecimentos...');
    const resultado = await buscaService.inicializarIndice();
    console.log('Resultado da inicialização:', resultado);
    console.log('Índice e alias configurados com sucesso!');
  } catch (erro) {
    console.error('Erro ao inicializar índice:', erro);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void bootstrap();
