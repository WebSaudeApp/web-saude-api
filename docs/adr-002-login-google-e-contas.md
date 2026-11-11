# ADR 002: Login com Google e Estratégia de Armazenamento de Contas

* **Status:** Decidido
* **Data:** 10 de Novembro de 2026
* **Contexto:** Issue **BE-38 (#65)** — Decidir antes da implementação definitiva do login como o sistema lidará com autenticação social ("Entrar com Google") e onde as contas e avaliações são persistidas sem dependência externa desnecessária.
* **Impacto:** Issues **BE-17 (#29)**, **BE-18 (#30)**, **BE-19 (#31)**, **BE-22 (#34)** e **FRONT-01 a FRONT-04** (`web-saude-interface`).

---

## 1. Contexto do Problema

O Web Saúde necessita autenticar usuários em três papéis: `PACIENTE`, `GESTOR` e `ADMINISTRADOR`.
Embora o fluxo tradicional de e-mail e senha (BE-17 e BE-18) atenda aos requisitos essenciais de segurança, a inclusão do botão "Entrar com Google" reduz significativamente o atrito de onboarding para pacientes em dispositivos móveis e navegadores web.

Surgiu o dilema sobre onde gerenciar e persistir essas contas:
1. **Opção A:** Apenas e-mail e senha tradicional (sem login social).
2. **Opção B:** Autenticação híbrida (E-mail/Senha + Google OAuth/OIDC) gerenciada diretamente pela API NestJS com persistência na base PostgreSQL do Supabase.
3. **Opção C:** Delegar autenticação completa para o **Firebase Auth**.

---

## 2. Matriz Comparativa de Opções

| Critério | (A) Só E-mail e Senha | (B) API NestJS + Google OIDC no PostgreSQL (Supabase) | (C) Firebase Auth |
| :--- | :--- | :--- | :--- |
| **Complexidade** | Mínima | Baixa a Média (validação padrão de `idToken` do Google) | Alta (duplicação de bases e sincronização por webhooks) |
| **LGPD e Dados Pessoais** | Centralizado no PostgreSQL | Centralizado no PostgreSQL auditável | Dados dispersos entre Google Cloud / Firebase e Postgres |
| **Dependência de Fornecedor** | Nenhuma | Nenhuma proprietária (OIDC é protocolo aberto) | Forte (*Vendor Lock-in* no Firebase/Google Cloud) |
| **Custo** | Zero adicional | Zero adicional (incluso no Postgres já existente) | Cobrança por MAU (Monthly Active Users) após cota gratuita |
| **Impacto em BE-17/18/19** | Nenhum | Nenhum (aproveita as tabelas `usuarios` e `sessoes`) | Alto (quebra modelo de sessões e refresh tokens próprios) |
| **Impacto no Front-end** | Rotas normais | Adiciona apenas botão Google que envia token à API | Requer SDK pesado do Firebase no client bundle |

---

## 3. Decidido

**Adotada a Opção B: Login Híbrido (E-mail/Senha + Google OAuth/OIDC) com persistência única na base de dados PostgreSQL (hospedada no Supabase). Rejeita-se categoricamente o uso do Firebase.**

### Diretrizes Técnicas Estabelecidas:

1. **Onde guardar as contas:**
   - 100% das contas residem na tabela `usuarios` do banco de dados relacional existente. Nenhuma conta é terceirizada para Firebase ou serviços externos.
   - Avaliações (`Review`), favoritos e estabelecimentos mantêm integridade referencial com `usuarios.id` via chave estrangeira direta.

2. **O que guardar da conta Google:**
   - **Salva-se apenas:** `googleId` (o identificador estável `sub` do payload do token do Google), o `email` (já verificado pelo Google), o `nome` e a foto de perfil se aplicável.
   - **NUNCA se guarda:** O access token ou refresh token do Google. O token do Google serve unicamente como credencial de troca no momento da autenticação.

3. **Como vincular conta de e-mail a uma conta Google:**
   - Se um usuário já cadastrado com `maria@email.com` fizer login com o Google usando o mesmo e-mail verificado, a API vincula o `googleId` à conta existente sem duplicar registros.
   - Se for um novo usuário, o registro é criado na tabela `usuarios` com `papel: PACIENTE`, `googleId` preenchido e `senhaHash: null`.

4. **Como ficam os Papéis (`roles`) e Sessões:**
   - O login social público cria exclusivamente contas com o papel **`PACIENTE`**. Contas do tipo `GESTOR` ou `ADMINISTRADOR` exigem solicitação e aprovação administrativa.
   - Independentemente de o login ter sido feito por e-mail/senha ou por Google, **a resposta da API é rigorosamente uniforme**: emite-se um JWT de curta duração (`accessToken`) assinado pela nossa API e um refresh token rotacionável gravado na tabela `sessoes`.

---

## 4. O que se ganha

1. **Soberania dos Dados e LGPD:** Todos os dados do paciente, logs e consentimentos ficam sob o controle estrito da aplicação no PostgreSQL, simplificando auditorias, anonimização e exclusão de contas.
2. **Custo Zero Adicional:** Elimina necessidade de contratar cotas de autenticação no Firebase ou ferramentas terceiras.
3. **Frontend Leve:** Não exige o SDK do Firebase. O front-end precisa apenas exibir o botão padrão do Google e enviar o token recebido para `POST /auth/google`.
4. **Sem Riscos de Inconsistência:** Sem delay de webhooks ou falhas de sincronização entre dois bancos de dados diferentes.

---

## 5. O que se perde

1. **Fluxo de Recuperação Próprio:** Usuários que criaram a conta exclusivamente via Google não possuem senha na nossa base (`senhaHash: null`). Se tentarem recuperar senha, a API deve orientá-los a entrar via botão Google ou definir uma senha através de um fluxo seguro de primeiro cadastro de senha.

---

## 6. Sinal para rever

* Se a plataforma passar a exigir múltiplos provedores corporativos complexos (ex: SAML/SSO hospitalar integrado com redes de operadoras de saúde privadas), momento no qual um IdP federado dedicado (como Keycloak) pode ser reavaliado.
