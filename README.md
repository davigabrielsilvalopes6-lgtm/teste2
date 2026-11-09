# ORIGENS

Protótipo em HTML, CSS e JavaScript, com mundo procedural desenhado em Canvas 2D. O ponto de entrada atual é `ORIGENS — Survival v0.7.html`, baseado no jogo enviado pelo usuário com ferramentas e mochilas. As versões v0.2 a v0.5 permanecem intactas. O HTML original do ZIP está em `backups/origens-v0.7-recebido.html`. Os gráficos são gerados dentro do HTML; não há sprites ou bibliotecas externas para baixar durante o jogo.

## Executar o jogo

O HTML continua autônomo. Para desenvolvimento, recomenda-se Node.js 24 LTS. As versões aceitas pelas ferramentas estão no campo `engines` do `package.json` (Node 20.19+, 22.13+ ou 24+):

```sh
npm start
```

O servidor escuta apenas no loopback, na porta 4173. A rota `/` entrega os bytes do HTML v0.7, sem transformações; os cinco HTMLs também podem ser acessados pelo nome. Ele não expõe `node_modules`, configurações ou outros arquivos do repositório.

## Testes Playwright

Em uma nova máquina:

```sh
npm ci
npm run test:e2e:install
npm run test:e2e
```

`@playwright/test` é uma dependência de desenvolvimento com versão exata e lockfile. O comando de instalação do navegador baixa o Chromium compatível com essa versão do Playwright. Em Linux, se faltarem bibliotecas do sistema, a alternativa oficial é `npx playwright install --with-deps chromium`; ela pode precisar de privilégios administrativos.

O Playwright inicia e encerra o servidor automaticamente por `webServer`. Não inicie `npm start` na mesma porta enquanto roda a suíte. Uma porta já ocupada causa falha explícita, sem reutilizar por engano um servidor de outro projeto.

Para usar um Chromium já instalado, sem baixar outro navegador:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Esse foi o modo validado no Codex Cloud. A variável é opcional: sem ela, a configuração usa o Chromium gerenciado pelo Playwright. O executável do sistema pode ter uma versão diferente da recomendada pelo Playwright; prefira o navegador gerenciado em máquinas com acesso ao download.

Outros comandos:

```sh
npm run test:unit           # coleta, inventário, crafting, ferramentas e mochilas
npm test                   # testes em Node + Playwright
npm run test:e2e:headed    # exige sessão gráfica disponível
npm run test:e2e:report    # abre o relatório HTML da última execução
```

Para passar opções ao runner: `npm run test:e2e -- --workers=1`.

## Estratégia dos testes

As specs ficam em `tests/e2e`. As suítes Node de coleta, inventário e crafting preservam as respectivas versões históricas; `tools.test.cjs` e `backpack.test.cjs` exercitam o código atual. O script CDP legado `tests/browser.test.cjs` foi preservado, mas não é executado pelo runner Playwright.

Cada teste usa um contexto de navegador isolado, sem importar saves pessoais. Menu e controles são acionados por mouse/teclado. Para o Canvas, os testes combinam pixels desenhados com observação do estado real do mundo e do movimento. O cenário da primeira ferramenta começa vazio, caminha por teclado e coleta recursos naturais sem inserir itens nem alterar a posição por código. Outros casos usam fixtures explícitas de materiais, saves ou posição para alcançar condições de borda. Não há hooks de teste no jogo nem substituição do motor de coleta ou crafting.

Erros de execução JavaScript, mensagens de erro de console, requisições falhadas e respostas HTTP de erro são verificados pela fixture. O jogo não tem escolha de origem elemental implementada: esse cenário aparece explicitamente como ignorado, com o motivo, em vez de simular uma funcionalidade futura.

A infraestrutura de testes não exige mudanças nas mecânicas. Os ajustes da entrega atual e a comparação com o arquivo recebido estão em `RELATORIO-v0.7.md`.

## Relatórios e falhas

- `playwright-report/`: relatório HTML.
- `test-results/`: screenshots de testes reprovados e traces das falhas.
- A configuração usa Chromium, dois workers e nenhum retry automático.

Esses diretórios, `node_modules` e outros resultados temporários estão no `.gitignore`. Falhas geram capturas automaticamente; os testes de apresentação também fazem capturas explícitas de aprovação. As evidências selecionadas ficam em `evidencias-v0.7/`.

Em sandbox restrita, iniciar processos de navegador ou ouvir no loopback pode exigir permissão adicional do executor. Não foi necessário desativar validação TLS ou modificar políticas de rede.

Os resultados atuais estão em `RELATORIO-v0.7.md`; o relatório da instalação inicial permanece em `RELATORIO-PLAYWRIGHT.md`.

## ESLint e Prettier

As dependências de desenvolvimento também incluem ESLint e Prettier, com versões exatas no lockfile. Instale-as com `npm ci`.

```sh
npm run lint
npm run format:check
```

O ESLint verifica JavaScript, inclusive os scripts inline dos HTMLs. `eslint.config.mjs` separa navegador, CommonJS/Node e configuração ESM. Os globais do jogo usados em callbacks `page.evaluate` são reconhecidos somente nos testes E2E. Identificadores indefinidos e as demais regras recomendadas são erros; variáveis não utilizadas são avisos. Parâmetros iniciados por `_` e exceções capturadas intencionalmente não geram aviso de variável não usada. Blocos `catch` vazios são permitidos para os fallbacks de armazenamento existentes.

O Prettier usa duas colunas, ponto e vírgula, aspas simples em JavaScript, largura de 100 caracteres e finais de linha LF. HTML, CSS e JavaScript embutidos também são contemplados. `.prettierignore` exclui dependências, relatórios gerados, lockfile gerado e os HTMLs v0.2 a v0.5 históricos e o backup original recebido. A v0.7 continua na verificação, para que divergências não sejam ocultadas.

O comando de escrita existe, mas **não foi aplicado à base do jogo nesta tarefa**:

```sh
npm run format
```

Esse comando aplica o Prettier a todos os arquivos não ignorados, inclusive o jogo atual. Para uma alteração pequena, prefira um arquivo específico, por exemplo `npx prettier --write eslint.config.mjs`, e revise o diff. Não há formatação automática durante instalação, testes ou lint, nem uso de `eslint --fix`.

O resultado das verificações e a dívida de formatação preservada estão em `RELATORIO-QUALIDADE.md`. O `format:check` retorna código 1 enquanto houver divergências; isso não equivale a um bug de jogabilidade. O lint retorna código 1 para erros; avisos continuam visíveis sem bloquear o comando. Para exigir zero avisos em CI, use `npm run lint -- --max-warnings 0`.

## Inventário v0.4

Pressione `I` para abrir/fechar a mochila 4×4. Ela tem exatamente 16 espaços, com até 200 unidades por pilha. Esquerdo pega, coloca, junta ou troca pilhas; direito pega metade (arredondada para cima) ou coloca uma unidade. Ao fechar, a pilha do cursor volta a espaços compatíveis; se não couber, a interface permanece aberta e os itens continuam protegidos.

A barra inferior tem 9 atalhos para os primeiros nove slots da mesma mochila. Teclas `1`–`9` ou clique selecionam, sem consumir nem usar materiais. A mochila aberta bloqueia WASD, extração e jangada; `E` continua sendo a tecla de embarque com a interface fechada. O mapa `M` mantém seu funcionamento.

Drops entram apenas até a capacidade disponível e o restante fica no chão. Saves v4 (`gv:2`, gerador inalterado) preservam slots, organização, cursor e seleção por mundo. Saves v3 migram os contadores uma vez, com backup anterior; excedentes ficam visíveis como materiais pendentes de recuperação, sem slots extras. O botão no painel só transfere o que realmente couber.

`npm run test:unit` executa coleta, inventário, crafting, ferramentas e mochilas; `npm run test:e2e` testa a versão atual no Chromium. A entrada atualizada serve por HTTP na mesma origem para manter o acesso aos saves. O HTML final continua autônomo, mas o armazenamento de arquivos locais diferentes pode ser separado pelo navegador.

Relatório da etapa e os 60 critérios: `RELATORIO-v0.4.md`.

## Crafting básico v0.5

`C` abre/fecha a fabricação. `I` alterna para a mochila e `Esc` fecha o painel ativo antes de voltar ao menu. Coloque a pilha do cursor na mochila antes de abrir o crafting. O painel mostra ingredientes efetivamente guardados nos 16 slots, sem contar cursor, reserva ou drops no chão.

As cinco receitas provisórias são: 1 madeira → 2 gravetos; 2 madeiras → 2 tábuas; 1 pedra → 2 pedras lascadas; 2 gravetos + 1 tábua → 1 cabo simples; 1 cabo simples + 2 pedras lascadas → 1 peça primitiva. Todos continuam sendo materiais, sem uso de equipamento.

Os botões fabricam 1 vez, 5 vezes ou o máximo possível. A operação simula consumo dos slots 15→0 e inserção do resultado antes de aplicar um único novo array de slots. Se o lote não couber inteiro, nada é consumido. A seleção da barra não é resetada.

O formato do save permanece `v:4`, com `gv:2`. Itens novos passam a ser reconhecidos no mesmo catálogo; não há migração duplicada de contadores. O jogo preserva um backup de save v4 antes da primeira sobrescrita. O painel informa alterações ainda não salvas e falhas de persistência. Saves v4 malformados podem ser recuperados parcialmente em memória, mas ficam protegidos contra sobrescrita; reparação manual/exportação não foi implementada nesta etapa.

Relatório, auditoria v0.4 e os 70 critérios: `RELATORIO-v0.5.md`.

## Versão atual v0.7: ferramentas e mochilas

As duas novidades vieram do HTML enviado pelo usuário. O machado de pedra usa 1 cabo simples, 2 pedras lascadas e 1 graveto. A picareta usa 1 cabo simples, 3 pedras lascadas e 1 graveto. Cada ferramenta ocupa um espaço; materiais continuam com máximo 200. Mova a ferramenta para um dos primeiros nove espaços e selecione com `1`–`9`. A ferramenta acompanha a mira do mouse. Machado derruba árvores em 2 golpes; picareta quebra rochas em 2 e minérios em 3. A mão e a ferramenta incorreta mantêm os valores anteriores: 3, 4 e 5 golpes. Alcance 80 pixels, intervalo 350 ms e drops inalterados.

A Mochila Rústica expande de 16 para 24 espaços e a Reforçada de 24 para 32. Fabrique em `C`, abra `I`, selecione o espaço da mochila e clique em **USAR MOCHILA**. Para selecionar sem carregar o item no cursor, use a tecla correspondente se estiver nos primeiros nove espaços, ou pegue e devolva ao mesmo espaço. O item é consumido uma vez; os itens anteriores mantêm suas posições. A barra continua com nove atalhos e compartilha o mesmo inventário. Em janelas estreitas, os espaços aparecem em quatro colunas com rolagem.

O save atual é `v:5`, conforme o arquivo recebido, com o mesmo gerador `gv:2`. Ele preserva nível da mochila, slots, cursor e seleção. Saves v2, v3 e v4 continuam reconhecidos; versões anteriores recebem backup. Não abra um mundo expandido em uma versão antiga do jogo, que não reconhece esse formato. Use a mesma origem do navegador para acessar os mesmos mundos.

Nesta entrega foram ajustados a mira visual, a largura da grade expandida, os textos sobrepostos e o cartão de capacidade ao trocar mundos. Nenhuma dependência foi adicionada. Relatório e matriz dos 100 critérios da etapa 0.6: [RELATORIO-v0.7.md](RELATORIO-v0.7.md).
