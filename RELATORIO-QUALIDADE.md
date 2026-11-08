# ESLint e Prettier — ORIGENS

## Estado encontrado

O projeto tinha dois HTMLs autônomos, JavaScript inline de navegador, servidor e testes em CommonJS/Node, além de Playwright configurado. Não existiam dependências ou configurações de ESLint/Prettier. O jogo atual é `ORIGENS — Survival v0.3.html`; o arquivo v0.2 é uma referência histórica preservada.

Ambiente de execução desta tarefa: Node **24.22.1**, npm **11.9.0**.

## Dependências e configurações

Foram adicionadas, com versões exatas em `devDependencies` e no lockfile:

| Dependência          | Versão  | Finalidade                                         |
| -------------------- | ------- | -------------------------------------------------- |
| `eslint`             | 10.14.0 | Análise de JavaScript                              |
| `@eslint/js`         | 10.0.1  | Regras recomendadas oficiais                       |
| `eslint-plugin-html` | 8.2.1   | Análise dos scripts inline dos HTMLs               |
| `globals`            | 17.14.0 | Globais conhecidos de navegador e Node             |
| `prettier`           | 3.9.10  | Formatação de HTML, CSS, JavaScript e documentação |

`@playwright/test` **1.65.0** e todos os scripts anteriores foram mantidos. Não foram adicionados frameworks de jogos ou dependências de runtime.

As ferramentas ESLint atuais exigem `^20.19.0 || ^22.13.0 || >=24`; o campo `engines.node` e o README foram ajustados a esse requisito. Recomenda-se Node 24 LTS.

### ESLint

`eslint.config.mjs` usa flat config, regras recomendadas para erros de programação e `no-unused-vars` como aviso. Arquivos `.js`/`.cjs` usam CommonJS e globais Node; `.mjs` usa ESM e Node; HTML usa scripts clássicos e globais do navegador. O plugin analisa o JavaScript embutido, não somente os arquivos externos.

Nos testes E2E, os globais reais do jogo são declarados como somente leitura para os callbacks `page.evaluate`. Essa exceção fica limitada a `tests/e2e`, sem liberar `G`, `ctx` ou `document` na infraestrutura Node em geral.

Parâmetros iniciados por `_` e erros capturados intencionalmente não geram avisos de variável não usada. Blocos `catch` vazios são permitidos para os fallbacks de armazenamento existentes. As demais regras recomendadas permanecem ativas; não houve ajustes para ocultar erros encontrados. Não foram incluídas regras de estilo que disputem formatação com o Prettier.

### Prettier

`.prettierrc.json` define indentação de dois espaços, largura de 100 caracteres, ponto e vírgula, aspas simples em JavaScript, vírgulas finais suportadas e finais de linha LF. HTML e CSS/JS embutidos são contemplados.

`.prettierignore` exclui dependências, relatórios/resultados gerados, cache do Playwright, lockfile gerado e a v0.2 histórica. A v0.3 atual e a documentação escrita manualmente continuam na verificação. O ESLint também ignora dependências e saídas geradas, mas verifica os dois HTMLs.

## Validação realmente executada

| Comando/verificação                                                    | Resultado                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Instalação npm e atualização offline do lockfile                       | Concluídas                                                                      |
| `npm run lint -- --format json --output-file /tmp/origens-eslint.json` | Código 0: 9 arquivos, **0 erros e 0 avisos**                                    |
| `npm run format:check`                                                 | Código 1: **9 arquivos com divergências de formatação**                         |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test`       | Código 0: **29 grupos Node aprovados; 8 testes Chromium aprovados; 1 ignorado** |
| Comparação SHA-256 antes/depois                                        | Ambos os HTMLs intactos                                                         |

O teste Playwright ignorado continua sendo a escolha elemental, ainda não implementada. Nenhum teste foi alterado ou desativado nesta tarefa. Não houve falhas na suíte executada.

Uma sonda adicional via API do ESLint analisou somente texto em memória, sem modificar arquivos: código HTML com variável não utilizada gerou aviso e acessos a nome indefinido/`process` geraram erros; código Node com variável não utilizada gerou aviso e acessos a nome indefinido/`document` geraram erros. Isso confirmou que o processamento inline e a separação dos ambientes estão ativos, evitando um falso sucesso que ignorasse o jogo. Esses diagnósticos provocados pertencem à sonda, não ao código do projeto.

### Divergências de formatação mantidas

O Prettier apontou estes arquivos:

1. `ORIGENS — Survival v0.3.html`
2. `playwright.config.js`
3. `RELATORIO-PLAYWRIGHT.md`
4. `RELATORIO-v0.3.md`
5. `scripts/serve.cjs`
6. `tests/browser.test.cjs`
7. `tests/collection.test.cjs`
8. `tests/e2e/fixtures.js`
9. `tests/e2e/origens.spec.js`

São divergências de estilo em arquivos existentes, não erros de sintaxe ou bugs de jogabilidade detectados. Elas foram preservadas porque a tarefa proíbe reformatar toda a base. O comando `format:check` permanece funcional e retorna código 1 enquanto essa dívida existir; os arquivos não foram excluídos apenas para produzir resultado verde.

Não foi executado `npm run format` sobre o repositório, nem `eslint --fix`. O Prettier de escrita foi utilizado apenas em arquivos de configuração/documentação criados ou modificados nesta tarefa: `eslint.config.mjs`, `.prettierrc.json`, `package.json`, `README.md` e este relatório.

## Preservação e arquivos alterados

Entre os arquivos que já existiam no início desta tarefa, somente estes foram modificados:

- `package.json`: scripts, novas dependências de desenvolvimento e requisito de Node.
- `package-lock.json`: resolução/integridade das dependências e requisito de Node.
- `README.md`: instruções das ferramentas e requisito de Node atualizado.

Arquivos criados:

- `eslint.config.mjs`
- `.prettierrc.json`
- `.prettierignore`
- `RELATORIO-QUALIDADE.md`

Os demais arquivos preexistentes permaneceram idênticos, incluindo testes, configuração Playwright, servidor, relatórios anteriores e ambos os HTMLs. Nenhuma mecânica, sprite, geração procedural ou formato de save foi alterado.

SHA-256 dos HTMLs, iguais aos registrados antes das mudanças:

```text
20e5d3613dfe78a8c995794cb59dbb81797c6bb0c56364b878be43a5cb14ad99  ORIGENS — Mundo Procedural v0.2.html
3e03c4833cb87fb4df321a9df77fb4f4878a6b798abff2d039065b76182c3ba7  ORIGENS — Survival v0.3.html
```

## Reexecutar

Na pasta do repositório:

```sh
npm ci
npm run lint
npm run format:check
```

`npm run lint` não aplica correções. Variáveis não usadas são avisos; para tratá-los como falha em CI, use `npm run lint -- --max-warnings 0`.

`npm run format` aplica mudanças a todos os arquivos não ignorados, inclusive o jogo atual; reserve-o para uma tarefa de formatação revisada. Para uma mudança controlada, é possível usar `npx prettier --write caminho/do/arquivo`. A configuração não executa formatação automaticamente durante instalação, lint ou testes.
