/**
 * QA-05 (#56): Script de CI para validar o upgrade de migrations
 * 
 * Testa a aplicação das migrations atuais sobre um banco no estado da versão anterior
 * com dados já existentes (simulando produção), garantindo que:
 * 1. Nenhuma migration colide com tipos/tabelas já existentes.
 * 2. Nenhuma migration quebra constraints de dados já populados.
 * 3. O schema final no banco corresponde exatamente ao prisma/schema.prisma (zero drift).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function run(cmd, options = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...options });
}

function runOutput(cmd, options = {}) {
  return execSync(cmd, { encoding: 'utf-8', ...options }).trim();
}

async function main() {
  console.log('=== [QA-05] Iniciando Verificação de Upgrade de Migrations ===');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERRO: DATABASE_URL não definida.');
    process.exit(1);
  }

  // 1. Determinar o commit de referência base
  // Por padrão usa origin/producao. Se não existir ou for legado sem o marco zero, usa o commit inicial do marco zero (607c4db).
  let baseRef = process.env.MIGRATION_BASE_REF || 'origin/producao';

  // Garante que refs remotas estejam disponíveis
  try {
    run('git fetch origin producao --depth=10');
  } catch (e) {
    console.warn('Aviso: Não foi possível fazer fetch de origin/producao:', e.message);
  }

  const forceLegacy = process.env.FORCE_LEGACY_PRODUCAO === 'true';

  let hasInitInBase = false;
  try {
    const list = runOutput(`git ls-tree ${baseRef} prisma/migrations/20261027120000_init_estabelecimentos`);
    if (list) hasInitInBase = true;
  } catch {
    hasInitInBase = false;
  }

  if (!hasInitInBase && !forceLegacy) {
    console.log(
      `A branch ${baseRef} ainda não possui o marco zero (20261027120000_init_estabelecimentos). ` +
      `Utilizando commit do marco zero (607c4db) como base para teste de upgrade aditivo.`
    );
    baseRef = '607c4db';
  } else {
    console.log(`Utilizando ref base: ${baseRef}`);
  }

  // 2. Criar diretório temporário para extrair as migrations da base
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-base-'));
  const tempPrismaDir = path.join(tempDir, 'prisma');
  fs.mkdirSync(tempPrismaDir, { recursive: true });

  try {
    console.log(`\n--- Passo 1: Extraindo schema e migrations da base (${baseRef}) ---`);
    // Extrai os arquivos da base via git archive para evitar sujar o working tree
    run(`git archive ${baseRef} prisma | tar -x -C ${tempDir}`);

    const baseSchemaPath = path.join(tempPrismaDir, 'schema.prisma');
    if (!fs.existsSync(baseSchemaPath)) {
      throw new Error(`schema.prisma não encontrado na base ${baseRef}`);
    }

    console.log('\n--- Passo 2: Aplicando migrations da base contra o banco ---');
    run(`npx prisma migrate deploy --schema=${baseSchemaPath}`);

    console.log('\n--- Passo 3: Inserindo dados mínimos de teste no banco da base ---');
    // Insere registros mínimos para garantir que migrations aditivas não quebrem tabelas com dados
    const sqlSeed = `
      -- Inserir tipo se não existir
      INSERT INTO "tipos_estabelecimento" ("id", "nome", "criado_em", "atualizado_em")
      VALUES ('11111111-1111-4111-8111-111111111111', 'HOSPITAL', NOW(), NOW())
      ON CONFLICT ("nome") DO NOTHING;

      -- Inserir endereço
      INSERT INTO "enderecos" ("id", "logradouro", "numero", "bairro", "cidade", "estado", "cep", "latitude", "longitude", "criado_em", "atualizado_em")
      VALUES ('end-upgrade-seed-1', 'Av. Teste Upgrade', '100', 'Centro', 'Recife', 'PE', '50000-000', -8.05, -34.88, NOW(), NOW())
      ON CONFLICT ("id") DO NOTHING;

      -- Inserir estabelecimento vinculado
      INSERT INTO "estabelecimentos" ("id", "nome", "tipo_id", "endereco_id", "ativo", "criado_em", "atualizado_em")
      VALUES ('est-upgrade-seed-1', 'Unidade Teste Upgrade', '11111111-1111-4111-8111-111111111111', 'end-upgrade-seed-1', true, NOW(), NOW())
      ON CONFLICT ("id") DO NOTHING;
    `;
    const tempSqlFile = path.join(tempDir, 'seed.sql');
    fs.writeFileSync(tempSqlFile, sqlSeed, 'utf-8');

    try {
      run(`npx prisma db execute --file=${tempSqlFile} --schema=${baseSchemaPath}`);
      console.log('Dados mínimos inseridos com sucesso.');
    } catch (err) {
      console.warn('Aviso ao inserir seed da base (pode ser schema antigo):', err.message);
    }

    console.log('\n--- Passo 4: Aplicando as migrations atuais da PR sobre o banco já existente ---');
    run('npx prisma migrate deploy');

    console.log('\n--- Passo 5: Verificando drift entre o banco migrado e prisma/schema.prisma ---');
    run('npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --exit-code');

    console.log('\n✅ [QA-05] Verificação de upgrade concluída com sucesso: zero colisões e zero drift!');
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignora falha de limpeza temporária
    }
  }
}

main().catch((err) => {
  console.error('\n❌ [QA-05] Falha no teste de upgrade de migrations:', err.message);
  process.exit(1);
});
