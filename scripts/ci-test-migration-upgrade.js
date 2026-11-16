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

  // 1. Ref base = ultima release (origin/producao). Sem fallback silencioso: se nao der
  //    para obter a base, o job FALHA (um teste que nao consegue falhar nao protege nada).
  const baseRef = process.env.MIGRATION_BASE_REF || 'origin/producao';
  run('git fetch origin producao');
  const migrationsDir = 'prisma/migrations';

  const baseDirs = runOutput(`git ls-tree --name-only ${baseRef} ${migrationsDir}/`)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith('migration_lock.toml') && !l.endsWith('.gitkeep'));
  if (baseDirs.length === 0) {
    throw new Error(`Nenhuma migration encontrada em ${baseRef}; base invalida.`);
  }

  // 1.1 Imutabilidade: toda migration da release deve existir identica no codigo atual.
  //     Squash/edicao de migration ja aplicada exige marco zero deliberado (runbook BE-33).
  const normalizar = (t) => t.replace(/\r\n/g, '\n').trim();
  const alteradas = [];
  for (const dir of baseDirs) {
    const arquivo = `${dir}/migration.sql`;
    let baseSql;
    try {
      baseSql = runOutput(`git show ${baseRef}:${arquivo}`);
    } catch {
      continue;
    }
    const atualPath = path.join(process.cwd(), arquivo);
    const atualSql = fs.existsSync(atualPath) ? fs.readFileSync(atualPath, 'utf-8') : null;
    if (atualSql === null || normalizar(atualSql) !== normalizar(baseSql)) {
      alteradas.push(dir);
    }
  }
  if (alteradas.length > 0) {
    if (process.env.ALLOW_MARCO_ZERO === 'true') {
      console.warn(
        `AVISO: ${alteradas.length} migration(s) da release foram removidas/alteradas, mas ALLOW_MARCO_ZERO=true ` +
          '(marco zero deliberado). Pulando o teste de upgrade; registre a decisao no PR.',
      );
      return;
    }
    throw new Error(
      `Migrations ja publicadas em ${baseRef} foram removidas ou alteradas (migration aplicada e imutavel):\n  ` +
        alteradas.join('\n  ') +
        '\nSe for um marco zero deliberado (dump + reset + registro), defina ALLOW_MARCO_ZERO=true.',
    );
  }
  console.log(`Utilizando ref base: ${baseRef} (${baseDirs.length} migrations, todas preservadas)`);

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

    // Falha do seed derruba o job: nao pode passar em silencio.
    run(`npx prisma db execute --file=${tempSqlFile} --schema=${baseSchemaPath}`);
    console.log('Dados minimos inseridos com sucesso.');

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
