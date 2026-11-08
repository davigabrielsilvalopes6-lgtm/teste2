# ORIGENS — Survival v0.5: crafting básico

## Entrega e auditoria

Jogo completo em `ORIGENS — Survival v0.5.html`, mantendo o modelo de HTML único autônomo. A v0.4 anterior, incluindo o visual dourado do inventário, foi preservada. Não há dependências novas nem imagens, fontes ou sons externos obrigatórios para jogar.

Antes da integração, executei a auditoria da v0.4: **42 grupos Node/VM e 10 testes Chromium aprovados**, com saída 0. Os quinze requisitos prévios foram confirmados pelos testes existentes:

| Requisito v0.4                                          | Resultado  |
| ------------------------------------------------------- | ---------- |
| 16 espaços exatos, pilhas válidas e limite 200          | Confirmado |
| Coleta de madeira, pedra e minério para os slots        | Confirmado |
| Nove atalhos ligados aos primeiros nove slots           | Confirmado |
| Seleção pelas teclas 1–9                                | Confirmado |
| Organização, divisão e agrupamento sem perda/duplicação | Confirmado |
| Cursor temporário e devolução protegida                 | Confirmado |
| Drops excedentes preservados                            | Confirmado |
| Saves, organização e seleção persistentes por mundo     | Confirmado |
| Independência de mundos, inclusive com seed igual       | Confirmado |
| Compatibilidade/migração de saves anteriores            | Confirmado |
| Abrir/fechar inventário preservando controles           | Confirmado |

Não foi necessário reconstruir o inventário ou a coleta. O gerador (`build`, `gen`, seed/ruído), arte do mundo, colisão, jangada e funções de extração foram comparados com a v0.4 e permaneceram idênticos. `GEN=2` foi mantido.

## Catálogo e receitas

`ITEM_TYPES` continua sendo o catálogo central. Os três IDs anteriores foram mantidos; foram acrescentados apenas `stick`, `plank`, `chipped_stone`, `simple_handle` e `primitive_component`. Todos os oito materiais usam os mesmos 16 slots, com pilhas de até 200. Ícones CSS distintos aparecem na mochila, na barra e no crafting.

| Receita/ID                                    | Ingredientes por execução             | Resultado               |
| --------------------------------------------- | ------------------------------------- | ----------------------- |
| Graveto / `recipe_stick`                      | 1 `wood`                              | 2 `stick`               |
| Tábua / `recipe_plank`                        | 2 `wood`                              | 2 `plank`               |
| Pedra lascada / `recipe_chipped_stone`        | 1 `stone`                             | 2 `chipped_stone`       |
| Cabo simples / `recipe_simple_handle`         | 2 `stick` + 1 `plank`                 | 1 `simple_handle`       |
| Peça primitiva / `recipe_primitive_component` | 1 `simple_handle` + 2 `chipped_stone` | 1 `primitive_component` |

São receitas provisórias, não balanceamento definitivo. Minério bruto continua coletável e armazenável, sem receita de fundição.

`CRAFT_RECIPES` é um registro imutável orientado a dados. Cada definição contém ID, nome, categoria, ingredientes, produto/quantidade, disponibilidade, ordem e `station:null`. `validateCraftRecipe` e `createCraftRecipeRegistry` validam referências ao catálogo, quantidades, IDs e duplicações; uma definição inválida é recusada sem derrubar as demais. Dados de save nunca viram funções ou receitas executáveis. Não há `eval` no código do jogo.

## Interface e controles

`C` não tinha função anterior e agora abre/fecha a fabricação. `I` alterna para a mochila; `Esc` fecha o painel ativo antes de voltar ao menu. Somente uma interface principal fica ativa. Com pilha no cursor, `C` recusa a troca e mantém a pilha e o inventário protegidos; os itens devem ser colocados/devolvidos primeiro.

O painel dourado possui as duas categorias reais, cinco receitas, ícone/nome/quantidade do resultado, contagem disponível/necessária de cada ingrediente e ações **1×**, **5×** e **MÁXIMO**. Ingredientes ausentes, falta de espaço e ações inválidas são indicados em texto. A disponibilidade é recalculada ao alterar o inventário ou selecionar receita, sem reconstrução por frame.

Enquanto o crafting está aberto, movimento, coleta, cliques no mundo, mapa e jangada ficam bloqueados. A barra continua mostrando os nove primeiros slots. Ao fechar, teclas mantidas não retomam o movimento sem nova entrada. Campos de texto continuam protegidos contra atalhos.

O estado de receitas é apresentação: cada clique chama `performCraft`, que consulta o inventário atualizado. Eventos de clique são registrados uma única vez; não há execução duplicada por `mousedown` mais `click`, nem cooldown artificial usado como defesa de integridade.

## Transações e inventário cheio

`countCraftMaterials` considera exclusivamente os 16 slots. Cursor, drops e reserva de migração não são ingredientes.

`simulateCraft` valida os parâmetros, clona as pilhas, consome ingredientes dos índices **15 até 0**, insere todos os resultados com o `addItems` existente e valida os limites. Só depois `executeCraft` confirma uma única atribuição a `inv.slots`. O objeto de inventário, seleção da barra, cursor e reserva não são substituídos. A coleta e o HUD continuam compartilhando a mesma fonte de verdade.

Se faltar qualquer ingrediente ou parte do lote não couber, o inventário real não muda. Pilhas 198+2 e 199+2 foram testadas; o excedente exige outro slot e não é produzido parcialmente. Um inventário inicialmente cheio pode fabricar se o consumo liberar espaço suficiente. O consumo por ordem decrescente preserva os slots da barra quando possível; a inserção mantém a prioridade existente de completar pilhas e depois usar espaços vazios.

Lotes de 5 são uma única transação, não cinco tentativas independentes. MÁXIMO faz uma busca descendente limitada pelos ingredientes e pela produção máxima física dos 16 slots, até no máximo 3.200 candidatos. Não usa busca binária nem presume capacidade monotônica: foi exercitado o caso em que fabricar 1 falha, mas fabricar 2 libera o slot e funciona.

Não há consulta ao mundo inteiro ou simulação de máximo por frame; só a receita selecionada precisa do cálculo de máximo na UI. Não foram criados timers para reparar estados. O bloqueio de reentrância tem `try/finally` e não fica preso após erro. Cada operação consulta os slots atuais, inclusive em cliques consecutivos com ingredientes suficientes para somente uma fabricação.

## Persistência e compatibilidade

O esquema permanece **`v:4` e `gv:2`**: a estrutura de slots não mudou, apenas o catálogo passou a reconhecer novos IDs. Posição, exploração, jangada, objetos removidos, dano parcial, drops e inventário continuam em `origens_w_<id>`, com índice `origens_idx_v2`.

As funções de contagem, reserva e serialização passaram a reconhecer os oito IDs, evitando `NaN` ou perda de novos materiais. A migração v0.3 continua restrita aos três contadores antigos e ocorre apenas ao carregar o esquema antigo; um save v4 nunca soma esses contadores novamente. A v0.4 real foi usada para criar um save no navegador, depois carregado/fabricado/salvo na v0.5.

Há uma cópia limitada por versão anterior (`_backup_v2`, `_backup_v3`, `_backup_v4`) antes da primeira sobrescrita. O backup v4 também foi incorporado à exclusão confirmada do mundo. Não há migração da seed ou do gerador por causa de crafting.

Alterações importantes agendam o save com o debounce de 600 ms existente, além dos caminhos de autosave periódico, menu, ocultação e `pagehide`. A operação inteira termina antes do snapshot. A interface distingue fabricação em memória, alterações pendentes e falha real de gravação. O teste de quota provocou uma tentativa real de `Storage.setItem`, aguardou a flag de falha, confirmou o save anterior intacto e verificou a recuperação após restabelecer a escrita.

Antes de gravar, o wrapper `save` recusa inventário ativo inválido. Um save v4 malformado pode ter entradas válidas recuperadas em memória, mas fica marcado como protegido: não é sobrescrito automaticamente por uma recuperação incompleta. Nesse caso, as alterações futuras continuam apenas em memória, inclusive o crafting; a UI informa a falha/proteção. Não foi implementado editor/exportação/reparo de saves nesta etapa. Para voltar ao seletor sem gravar essa sessão protegida, recarregue a página; o registro original permanece no armazenamento.

A compatibilidade é de versões antigas para a v0.5. Versões anteriores não conhecem os novos IDs: depois de fabricar, continue abrindo esses mundos na v0.5. Não foi implementada migração de downgrade, sincronização entre abas ou transferência automática entre origens/perfis do navegador.

## Testes efetivamente executados

Ambiente: Node 24.22.1, Playwright 1.65.0 e Chromium 155.0.8059.79 do sistema. Nenhuma dependência foi instalada nesta etapa.

```sh
node tests/inventory.test.cjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- tests/e2e/inventory.spec.js
node tests/crafting.test.cjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
npm run lint -- --format json --output-file /tmp/origens-v05-final-eslint.json
npm run format:check
```

| Verificação final                                     | Resultado                                              |
| ----------------------------------------------------- | ------------------------------------------------------ |
| Coleta/geração histórica                              | 29 grupos aprovados                                    |
| Inventário histórico                                  | 42 grupos aprovados                                    |
| Crafting e integração                                 | 42 grupos aprovados                                    |
| Playwright: 12 crafting + 10 inventário + 8 regressão | 30 aprovados, 0 reprovados, 1 ignorado                 |
| Cinco cenários completos da especificação             | Todos aprovados no Chromium                            |
| ESLint                                                | 0 erros e 0 avisos                                     |
| Prettier check                                        | Divergências herdadas/HTML atual preservadas; código 1 |

O único teste ignorado é a escolha de origem elemental, que não existe e não pertence aos 70 critérios desta etapa. Os 70 critérios foram exercitados em casos agrupados; a tabela ao final identifica evidências de lógica e navegador. Não foram contados como aprovados testes sem execução.

Os cinco cenários completos foram executados: árvore → coleta → graveto → recarga; cadeia das cinco receitas; inventário lotado com rollback/liberação de espaço; mundos A/B com seed igual e produtos distintos; coleta e operações repetidas com divisão, movimentação, lote e recarga.

A suíte Node usa o modelo realmente embutido no HTML e a integração real de save/coleta/controles, substituindo apenas a pintura DOM no realm de integração. Há 1.500 operações com oracle independente das transformações das receitas. A revisão independente também executou o caso máximo não monotônico no modelo integrado.

No navegador, mouse/teclado, menu, cliques repetidos, recargas e tentativas reais de gravação são exercitados. Fixtures controladas inserem materiais e posicionam o personagem ao lado de recursos/costa para tornar os casos reproduzíveis; os golpes e a coleta dos cenários completos usam os eventos reais. Isso não equivale a uma partida inteira percorrida manualmente.

Foram inspecionadas as capturas `/tmp/origens-v05-crafting.png` (1280×800) e `/tmp/origens-v05-crafting-small.png` (640×480). O painel menor usa rolagem interna, mantendo acesso aos controles. Não foram detectados erros inesperados de JavaScript, console ou carregamento na execução final.

### Falhas iniciais e correções

A primeira execução completa de E2E teve **28 aprovados, 2 reprovados e 1 ignorado**:

1. O servidor de testes passou a servir a v0.5, mas a whitelist inicialmente omitiu o HTML v0.4. O teste de compatibilidade real recebeu 404. A v0.4 foi reincluída e o teste passou.
2. Uma asserção antiga esperava somente três chaves de reserva. O novo catálogo preservava corretamente os valores antigos e acrescentava cinco zeros. A expectativa foi atualizada explicitamente para os oito campos, mantendo a verificação de conservação; nenhum material foi descartado ou adicionado para satisfazer o teste.

Screenshots e traces dessas falhas foram capturados pelo Playwright e preservados localmente em `/tmp/origens-v05-initial-failures/` antes da nova rodada. Após as correções, `npm test` terminou com saída 0, todos os **113 grupos Node** e **30 testes Chromium** aprovados; o E2E final levou aproximadamente 35,9 s. Não há falhas pendentes nos cenários executados.

## Limitações e escopo

O HTML foi validado por HTTP local. A política do Chromium gerenciado bloqueia URLs `file://`, portanto a abertura direta do arquivo não foi testada aqui. O arquivo contém todo o jogo e continua podendo ser aberto em navegador local que permita arquivos. A prévia online usa o HTML público, mas o serviço externo de preview continua fora da rede permitida deste ambiente; os testes de navegador não foram executados nesse serviço.

Não foram testados outros navegadores, dispositivos móveis, encerramento forçado do processo, falha física ou perda integral de armazenamento. `pagehide`, falha de escrita e recarga real foram verificados; isso não garante recuperação perfeita em qualquer interrupção.

Saves parcialmente recuperados não têm fluxo de reparação nesta etapa. As divergências de estilo do HTML herdado não foram resolvidas reformatando o gerador inteiro. Nenhuma dessas limitações implica fabricação parcial ou duplicação nos cenários aprovados.

Não foram implementados ferramentas equipáveis, armas, armaduras, construção, bancadas físicas, fornalhas, combustível, metalurgia, baús, expansão/fabricação de mochila, pesquisas, habilidades, NPCs, automação ou novas ilhas. Os cinco produtos são materiais intermediários, sem uso de equipamento ou colocação no mundo.

## Arquivos e reprodução

Criados: `ORIGENS — Survival v0.5.html`, `tests/crafting.test.cjs`, `tests/e2e/crafting.spec.js`, este relatório e os arquivos de entrega `origens-v0.5.html`, `origens-v0.5.zip`, `relatorio-v0.5.md`.

Atualizados: `scripts/serve.cjs` (entrada atual/arquivos históricos), `tests/e2e/fixtures.js` (título v0.5), `tests/e2e/inventory.spec.js` (reserva com oito IDs), `package.json`/`package-lock.json` (versão 0.5.0 e novo teste Node), `eslint.config.mjs` (dois globais dos callbacks E2E), `.prettierignore` (v0.4 histórica), `README.md`.

HTMLs e arquivos de entrega v0.4, HTMLs v0.2/v0.3 e testes históricos Node permaneceram intactos. Nenhum arquivo do ambiente ou política de rede foi reconfigurado. A implementação continua sem framework de jogos.

Para repetir a validação completa neste ambiente:

```sh
npm ci
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
npm run lint
```

Em outra máquina, `npm run test:e2e:install` prepara o Chromium gerenciado pelo Playwright; depois `npm test` pode ser usado sem a variável do executável. Para executar apenas o núcleo novo: `node tests/crafting.test.cjs`. `npm start` serve a v0.5; o servidor do Playwright inicia/encerra automaticamente nos testes.

## Evidência por critério 01–70

**L** = lógica/integração Node/VM v0.5; **B** = Chromium real. Critérios de regressão também são cobertos pelas suítes de inventário/exploração executadas na v0.5. Um grupo pode verificar vários critérios.

| Critério | Verificação                                                                              | Resultado | Evidência |
| -------- | ---------------------------------------------------------------------------------------- | --------- | --------- |
| 01       | verificar que todas as cinco receitas provisórias possuem IDs únicos.                    | Aprovado  | L         |
| 02       | verificar que todos os ingredientes existem no catálogo.                                 | Aprovado  | L         |
| 03       | verificar que todos os produtos existem no catálogo.                                     | Aprovado  | L         |
| 04       | rejeitar receita com quantidade negativa.                                                | Aprovado  | L         |
| 05       | rejeitar receita com produto inexistente.                                                | Aprovado  | L         |
| 06       | rejeitar solicitação de receita desconhecida.                                            | Aprovado  | L         |
| 07       | fabricar gravetos consumindo madeira.                                                    | Aprovado  | L + B     |
| 08       | fabricar tábuas consumindo madeira.                                                      | Aprovado  | L + B     |
| 09       | fabricar pedras lascadas consumindo pedra.                                               | Aprovado  | L + B     |
| 10       | fabricar cabo simples com materiais intermediários.                                      | Aprovado  | L + B     |
| 11       | fabricar peça primitiva com materiais intermediários.                                    | Aprovado  | L + B     |
| 12       | verificar que o minério bruto não é consumido por receitas que não o utilizam.           | Aprovado  | L + B     |
| 13       | verificar que os ingredientes são consumidos nas quantidades corretas.                   | Aprovado  | L + B     |
| 14       | verificar que os resultados são produzidos nas quantidades corretas.                     | Aprovado  | L + B     |
| 15       | tentar fabricar sem ingredientes.                                                        | Aprovado  | L + B     |
| 16       | tentar fabricar com apenas parte dos ingredientes.                                       | Aprovado  | L + B     |
| 17       | tentar fabricar utilizando pilhas distribuídas entre vários slots.                       | Aprovado  | L + B     |
| 18       | verificar que uma fabricação impossível não altera o inventário.                         | Aprovado  | L + B     |
| 19       | confirmar que a interface identifica corretamente os materiais ausentes.                 | Aprovado  | B         |
| 20       | adicionar resultados a uma pilha existente.                                              | Aprovado  | L + B     |
| 21       | fabricar até atingir exatamente 200 unidades.                                            | Aprovado  | L + B     |
| 22       | fabricar com uma pilha contendo 199 unidades.                                            | Aprovado  | L + B     |
| 23       | confirmar que nenhum slot ultrapassa 200.                                                | Aprovado  | L + B     |
| 24       | confirmar que o excedente ocupa outro slot apenas se existir capacidade.                 | Aprovado  | L + B     |
| 25       | fabricar com espaço disponível.                                                          | Aprovado  | L + B     |
| 26       | fabricar quando o consumo libera um slot necessário para o produto.                      | Aprovado  | L + B     |
| 27       | rejeitar fabricação quando não há capacidade para todos os resultados.                   | Aprovado  | L + B     |
| 28       | confirmar que ingredientes não são consumidos em fabricação rejeitada.                   | Aprovado  | L + B     |
| 29       | confirmar que o sistema não cria um décimo sétimo slot.                                  | Aprovado  | L + B     |
| 30       | confirmar que a barra rápida não cria armazenamento adicional.                           | Aprovado  | L + B     |
| 31       | fabricar uma vez uma receita com resultado de duas unidades.                             | Aprovado  | L + B     |
| 32       | fabricar cinco vezes consumindo os ingredientes multiplicados corretamente.              | Aprovado  | L + B     |
| 33       | rejeitar lote quando faltam ingredientes.                                                | Aprovado  | L + B     |
| 34       | rejeitar lote quando não existe espaço para todos os resultados.                         | Aprovado  | L + B     |
| 35       | garantir que um lote não seja fabricado parcialmente.                                    | Aprovado  | L + B     |
| 36       | verificar o cálculo do máximo fabricável, caso a função exista.                          | Aprovado  | L + B     |
| 37       | verificar que operações de fabricação máxima não travam a interface.                     | Aprovado  | B         |
| 38       | executar cliques rápidos repetidos.                                                      | Aprovado  | L + B     |
| 39       | executar dois eventos de fabricação consecutivos com material suficiente apenas para um. | Aprovado  | L + B     |
| 40       | atualizar ingredientes enquanto outra receita é selecionada.                             | Aprovado  | L + B     |
| 41       | impedir fabricação com dados desatualizados.                                             | Aprovado  | L + B     |
| 42       | conferir conservação de quantidades durante uma sequência extensa de crafting.           | Aprovado  | L + B     |
| 43       | abrir crafting sem item no cursor.                                                       | Aprovado  | L + B     |
| 44       | tentar abrir crafting segurando uma pilha.                                               | Aprovado  | L + B     |
| 45       | garantir que a pilha segurada não desapareça.                                            | Aprovado  | L + B     |
| 46       | garantir que cliques no crafting não atinjam objetos do mundo.                           | Aprovado  | B         |
| 47       | impedir movimentação acidental com o menu aberto.                                        | Aprovado  | L + B     |
| 48       | fechar crafting e restaurar os controles corretamente.                                   | Aprovado  | L + B     |
| 49       | verificar que a barra rápida atualiza após o consumo de ingredientes.                    | Aprovado  | L + B     |
| 50       | verificar que a disponibilidade de receitas atualiza sem reabrir o menu.                 | Aprovado  | L + B     |
| 51       | fabricar, salvar e recarregar o mundo.                                                   | Aprovado  | L + B     |
| 52       | verificar que os ingredientes consumidos não reaparecem.                                 | Aprovado  | L + B     |
| 53       | verificar que os produtos fabricados não desaparecem.                                    | Aprovado  | L + B     |
| 54       | alternar entre dois mundos com inventários diferentes.                                   | Aprovado  | L + B     |
| 55       | criar dois mundos com a mesma seed e confirmar inventários independentes.                | Aprovado  | L + B     |
| 56       | carregar um mundo antigo da versão 0.4.                                                  | Aprovado  | L + B     |
| 57       | verificar que migrações antigas não são repetidas.                                       | Aprovado  | L + B     |
| 58       | simular falha de salvamento e verificar a indicação apropriada.                          | Aprovado  | L + B     |
| 59       | verificar movimentação WASD após fechar o menu.                                          | Aprovado  | L + B     |
| 60       | verificar o sistema de coleta de árvores.                                                | Aprovado  | L + B     |
| 61       | verificar a coleta de pedras.                                                            | Aprovado  | L + B     |
| 62       | verificar a coleta de minérios.                                                          | Aprovado  | L + B     |
| 63       | confirmar que drops excedentes permanecem no chão.                                       | Aprovado  | L + B     |
| 64       | verificar embarque e desembarque da jangada.                                             | Aprovado  | B         |
| 65       | verificar mapa e minimapa.                                                               | Aprovado  | B         |
| 66       | verificar os nove atalhos de teclado.                                                    | Aprovado  | L + B     |
| 67       | verificar que o inventário continua com exatamente 16 espaços.                           | Aprovado  | L + B     |
| 68       | verificar que os objetos destruídos continuam persistentes após carregar.                | Aprovado  | L + B     |
| 69       | verificar que a seed continua reproduzindo o mapa correspondente.                        | Aprovado  | L + B     |
| 70       | verificar ausência de erros relevantes no console durante os fluxos principais.          | Aprovado  | B         |
