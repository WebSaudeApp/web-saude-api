import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { BuscaService } from '../busca.service';
import { EstabelecimentosService } from '../../estabelecimentos/estabelecimentos.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const buscaService = app.get(BuscaService);
    const estabelecimentosService = app.get(EstabelecimentosService);

    console.log(
      '--- Iniciando Carga / Reindexação Completa do Banco para o Elasticsearch ---',
    );
    console.log('1. Verificando disponibilidade do Elasticsearch...');
    const online = await buscaService.estaDisponivel();
    if (!online) {
      console.error(
        'ERRO: Elasticsearch não está acessível na porta configurada.',
      );
      process.exit(1);
    }

    console.log('2. Garantindo existência do índice e alias...');
    await buscaService.inicializarIndice();

    console.log(
      '3. Lendo estabelecimentos do PostgreSQL (Supabase) e indexando...',
    );
    const resultado = await estabelecimentosService.reindexarTodos();

    console.log('\n--- Resumo da Carga Completa ---');
    console.log(`Total de estabelecimentos no banco: ${resultado.total}`);
    console.log(`Indexados com sucesso:              ${resultado.indexados}`);
    console.log(`Falhas / Erros:                     ${resultado.erros}`);

    if (resultado.falhas.length > 0) {
      console.log('\nDetalhe das falhas:');
      for (const f of resultado.falhas) {
        console.log(` - ID ${f.id}: ${f.erro}`);
      }
    }

    console.log('\nCarga finalizada com sucesso!');
  } catch (erro) {
    console.error('Erro fatal durante a reindexação:', erro);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void bootstrap();
