# ORIGENS v0.8 — Baús e armazenamento

## Base e auditoria antes da edição

Base: `ORIGENS — Survival v0.7.html`, SHA-256 `bf28ee7e630d09bcd4ce837025b768599cbb7358bfdca6d1c51543863fae31a9`. A versão anterior, seus artefatos e o backup recebido do usuário permanecem intactos. A inspeção real foi registrada antes da edição em `/tmp/origens-v08-audit.json`; não foram presumidas funcionalidades futuras.

A base usa HTML/CSS/JavaScript inline, Canvas 960×540, tiles de 32 pixels, gerador 2, quatro níveis de zoom, recursos esparsos modificados por índice, inventário de 16/24/32 espaços e nove atalhos vinculados ao mesmo array. As nove receitas anteriores, machado, picareta, mochilas e persistência estavam implementados e testados na entrega v0.7. F estava livre; E era e continua sendo a jangada.

Funções reais identificadas como afetadas antes de programar: `inventoryReady`, `inventorySlotClick`, `addItems`, `serializeInventory`, `restoreInventory`, `setInventoryOpen`, `sessionInputActive`, `inventoryChanged`, `setCraftingOpen`, `save`, `safeSavedInventory`, `saveSnapshot`, `start`, `loadWorld`, `menu`, `blocked`, `update`, `draw`, `primaryAction`, `worldInputActive`, `refreshInventoryTooltip`, `updateInventoryCursor`. Os listeners existentes de teclado/mouse foram ampliados, sem instalar outros frameworks ou reconstruir o jogo.

## Implementação

- Catálogo: `wooden_chest`, categoria `storage`, pilha máxima 1, capacidade centralizada de 27 após posicionamento. O item não contém um inventário portátil nem expande a mochila.
- Receita: `recipe_wooden_chest`, 8 tábuas + 4 madeiras → 1 baú, categoria Armazenamento. Usa o mesmo motor de crafting; lote de cinco requer cinco slots após o consumo simulado. Operação recusada não consome ingredientes.
- Cada sessão possui `G.storage`: mapas `byId` e `byTile`, contador monotônico `nextId`, origem do cursor, revisão transitória e informações de proteção/erros. Cada baú contém ID `chest-N`, tipo, tileX/tileY e array próprio de 27 slots. IDs nunca são reutilizados após remoção e recarga; mundos de mesma seed possuem registros independentes.
- A colisão tem corpo no tile x+4…28/y+10…30, compatível com a perspectiva e com a caixa original do jogador. Os baús usam o índice espacial e o desenho existente por linhas, com ajuste por profundidade dos pés na mesma linha do personagem. Não são procurados todos os baús a cada tile.
- Desenho provisório de madeira, tampa, ferragem e estados aberto/fechado é feito no próprio Canvas. A prévia semitransparente e a borda verde/vermelha acompanham câmera/zoom. Não há sprite externo nem imagem gerada.
- Posicionamento: item válido selecionado, alcance de 80 pixels, caminho desimpedido, terra firme, sem objeto, baú, jogador, spawn ou drop no tile. Água, lava, fora do mapa, interfaces, mapa e jangada são rejeitados. Cliques repetidos respeitam 350 ms e o item real é consumido somente com o registro completo validado.
- Conectividade: os vizinhos transitáveis precisam manter um desvio local sem o tile candidato. A busca é limitada a 9×9 tiles; ela recusa conservadoramente um desvio que só existisse mais longe. Isso evita fechar corredores sem percorrer o mundo a cada movimento do mouse. A prévia usa cache transitório e não salva, cria colisão ou consome itens.
- O limite de novos posicionamentos é 128 baús por mundo. Registros válidos acima desse limite continuam carregáveis; o limite não apaga armazenamento existente.
- F abre o baú acessível mais próximo em até 80 pixels; empates usam ID numérico determinístico. Abertura não recria slots. F/Esc fecha somente o painel ativo. I/C só trocam de painel se o cursor puder ser recuperado. Digitação em inputs não seleciona atalhos.
- A interface possui 27 espaços, nove colunas, inventário inferior com toda capacidade liberada, tooltips, cursor visual único, detalhes do item, feedback e estado do salvamento. O painel tem rolagem em telas menores. Não há movimentos/coleta/mapa/jangada enquanto o armazenamento está aberto.

## Transferências, conservação e cursor

`containerAddItems` e `containerSlotClick` generalizam as operações anteriores; `addItems` e `inventorySlotClick` preservam suas validações e delegam a elas. Materiais continuam limitados a 200; ferramentas, mochilas e baús ocupam slots individuais.

`simulateStorageClick` prepara cópias dos dois recipientes e do cursor. Esquerdo pega/coloca/junta/troca; direito divide com arredondamento para cima ou deposita uma unidade. Shift + esquerdo completa pilhas parciais antes de ocupar slots vazios. Se apenas parte couber, a sobra fica na origem. Um cursor já ocupado não é transferido junto por Shift.

`commitStoragePlan` valida o plano inteiro, a identidade do baú e propriedades graváveis antes de confirmar os estados na mesma execução síncrona. Não existe espera entre retirada e inserção; handlers e autosave não veem uma metade. A identidade do inventário do jogador permanece, mantendo a visão de materiais já existente.

Só `G.inventory.cursor` contém itens pendentes. `cursorOrigin` registra recipiente e slot para recuperação. Fechar tenta o slot original, demais espaços daquele recipiente e depois o outro recipiente. Se ainda houver sobra, o cursor permanece protegido e o painel continua aberto. No reload, o cursor é restaurado uma vez; um baú de origem acessível pode ser reaberto para recuperação. Se não for possível, a mochila oferece acesso à pilha pendente.

Ferramentas dentro de baú deixam de estar equipadas quando saem do slot ativo. Mochilas guardadas não aplicam expansão. Guardar um item de baú não cria outro armazenamento interno.

## Persistência, migração e remoção

Schema atual `v:6`, gerador `gv:2`. O mesmo `localStorage.setItem` grava jogador, inventário, exploração, recursos/drops e todos os baús com conteúdos/ordem/IDs/origem do cursor em um único registro `origens_w_<id>`. Uma transferência não é dividida em duas chaves. A gravação é conferida; falhas mantêm o estado em memória e mostram alterações não salvas.

Saves v2–v5 continuam reconhecidos. A coleção de baús começa vazia; não são dados baús gratuitos. Inventário, ferramentas, mochilas, seed, exploração, posição e sobreposição de coleta são preservados conforme o gerador compatível. Um backup da versão anterior (v2/v3/v4/v5) é mantido antes da primeira sobrescrita. O comportamento histórico para saves de gerador antigo continua com aviso de incompatibilidade de mapa; gerador antigo não foi reimplementado.

IDs/coordenadas duplicadas, tipos/itens desconhecidos, quantidades inválidas, arrays incorretos ou terreno incompatível acionam proteção. Registros válidos podem ser exibidos, mas o save original fica intocado e operações destrutivas/gravações são bloqueadas. Não existe conversão silenciosa de baú cheio em vazio. Um editor de recuperação não foi implementado.

`storageRemoveCheck` e `removeStorageChest` permitem recolher somente baú vazio, próximo, acessível, sem cursor e com espaço na mochila. A simulação devolve um item e remove os índices/colisão juntos. Cliques repetidos não devolvem outro item. Recolocar cria identidade nova e conteúdo vazio. Baú cheio não é quebrado nem despeja itens.

## Funções adicionadas e alteradas

Modelo: `createStorage`, `storageSlotsReady`, `storageReady`, `restoreStorage`, `serializeStorage`, `containerAddItems`, `containerSlotClick`, `simulateStorageClick`, `simulateStorageReturn` e auxiliares de validação/clonagem/origem.

Sessão: `storageSessionCheck`, `commitStoragePlan`, `placeStorageChest`, `openStorageChest`, `storageSlotAction`, `closeStorageChest`, `storageRemoveCheck`, `removeStorageChest`, `storageChanged` e mensagens.

Mundo: `selectedChestItem`, `storageChestAt`, `storageChestBlocks`, `storageBase`, `storageSegmentClear`, `storagePathClear`, `storageAccessCheck`, `storageLocalAccessSafe`, `canPlaceStorageChest`, `nearestStorageChest`, `storagePreviewState`, `drawStorageChest`, `drawStoragePreview`, `drawStorageHint`.

Interface: `initStorageUI`, `renderStorageUI`, `clearStorageUI`, `renderStorageSaveState`, `refreshStorageTooltip`, `setStorageStatus` e construção/preenchimento dos botões.

As funções anteriores afetadas estão listadas na auditoria acima. Também foram atualizados `isHudPoint`, `menu`, os eventos de entrada e a inicialização final. O gerador e os sprites anteriores não foram alterados.

## Validação executada

Ambiente: Node 24.22.1, npm 11.9.0, Playwright Test 1.65.0 e Chromium 155.0.8059.79 em Linux. A execução final do navegador usa dois workers, sem retries.

| Verificação realmente executada               | Resultado                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| Coleta/geração Node (referência v0.3)         | 29 grupos aprovados, incluindo gerações 128/256/512/1024                        |
| Inventário Node (referência v0.4)             | 42 grupos aprovados                                                             |
| Crafting Node (referência v0.5)               | 42 grupos aprovados                                                             |
| Ferramentas e mochilas Node (referência v0.7) | 45 + 23 grupos aprovados                                                        |
| Armazenamento Node (HTML atual v0.8)          | 42 grupos aprovados                                                             |
| Total Node na execução de npm test            | 223 grupos aprovados                                                            |
| npm run test:e2e após ajustes dos testes      | 59 aprovados, 0 reprovados, 1 ignorado, 1,9 minuto                              |
| npm run lint                                  | 0 erros, 0 avisos                                                               |
| npm run format:check                          | Código 1: divergências de estilo em 9 arquivos, mantidas sem reformatação geral |

A primeira chamada de `npm test` terminou com código 1 devido às duas falhas de teste descritas abaixo. Após os ajustes somente nos testes, a suíte completa do navegador terminou com código 0. Os grupos Node já aprovados não foram repetidos sem mudança de código que justificasse isso. Os logs preservam ambas as execuções.

O Prettier apontou o HTML canônico/publicado v0.8 e sete arquivos existentes: `playwright.config.js`, `RELATORIO-PLAYWRIGHT.md`, `RELATORIO-v0.3.md`, `tests/browser.test.cjs`, `tests/collection.test.cjs`, `tests/e2e/fixtures.js`, `tests/e2e/origens.spec.js`. Os novos testes e documentos foram formatados individualmente. O lint e a formatação têm resultados distintos; o estilo pendente não foi apresentado como aprovado.

O teste completo do primeiro baú reúne madeira e pedra andando e clicando normalmente; navega de jangada até outra ilha para minerar minério, fabrica as tábuas e o baú, posiciona, abre com F, guarda os três materiais, salva/recarrega e retira parte. O planejamento de caminhos é somente leitura; não insere materiais, teleporta ou altera saves. Outros testes usam fixtures explicitamente identificadas para casos de borda.

Os testes Node da v0.8 usam o script real e substituem apenas pintura DOM. Eles verificam 5.400 operações mistas com um controle independente das quantidades em três baús, cursor, pendências e mochilas de 16/24/32 slots. O modelo também foi comparado com as operações originais em 15.000 entradas, além de 6.000 operações do novo modelo em probes de desenvolvimento. Isso não substitui a validação dos eventos e pixels no navegador.

Os 115 critérios são agrupados em verificações: a suíte Node cobre 112 deles, exceto 38 (DOM), 99 (mapa/minimapa) e 115 (console). Coordenadas da prévia são verificadas em VM; raster e eventos são verificados no Chromium. As suítes históricas continuam exercitando suas versões de referência, enquanto a nova suíte e os E2E exercitam a versão atual.

## Falhas, problemas corrigidos e limitações

Na primeira execução completa, os 223 grupos Node passaram; no navegador, 57 passaram, 2 falharam e 1 foi ignorado. A primeira falha era uma suposição do teste: o drop já podia ter sido recolhido automaticamente, e depois uma leitura separada de inventário/drop podia contá-lo duas vezes. O teste passou a ler os dois estados numa única avaliação e verificar a conservação exata. A segunda falha foi instabilidade do botão de mochila durante a inspeção pelo mouse; o fluxo de teste passou a selecionar a mochila pelo atalho normal de teclado e afastar o ponteiro antes de usar. Não se usou clique forçado nem se alterou a coleta para fazer o teste passar. O ciclo completo isolado passou em 34,9 segundos; a seleção/expansão em 1280×800 também passou ao ser repetida.

Foram corrigidos ainda um valor inicial redundante e uma função de mensagens sem uso detectados pelo ESLint no código novo. Não houve alteração de mecânica nesse ajuste. A oscilação do cartão de inspeção do inventário ao mudar o item sob o mouse pode deslocar controles na interface anterior; a seleção por teclado funciona e foi validada. Isso não foi apresentado como correção da interface histórica.

A seleção de origem elemental não está implementada e mantém seu teste explicitamente ignorado. Não foram adicionadas origens nesta etapa. Firefox/WebKit, toque e dispositivos móveis reais não foram executados; janelas estreitas são verificadas no Chromium desktop.

O ambiente foi suspenso e falhou ao reiniciar durante o trabalho. Depois de disponível, os comandos foram retomados sobre os arquivos existentes. O navegador requer execução permitida fora da sandbox para processos/loopback. Não foi preciso instalar novas dependências ou desabilitar TLS.

O preview público HTMLPreview esteve bloqueado pelo proxy em entregas anteriores. A confirmação funcional é por HTTP local no Chromium; a publicação raw é conferida separadamente. O armazenamento do navegador pertence à origem: outro domínio não importa saves automaticamente. Não há sincronização de contas nem garantia de recuperar uma alteração após encerramento abrupto antes de qualquer gravação.

A proteção de saves corrompidos é conservadora: o registro original é preservado e o jogador é informado; não existe editor/exportador de recuperação nesta versão. A busca local de posicionamento pode rejeitar áreas cuja única rota alternativa seja distante, como medida de preservação da conectividade.

Ficaram de fora baús duplos, upgrades, recipientes portáteis cheios, peso, automação, máquinas, construções gerais, combate, novos biomas e toda a versão 0.9.

## Repetir os testes e jogar

```sh
npm ci
npm run test:e2e:install
npm test
npm run lint
npm run format:check
npm start
```

Com o Chromium instalado no ambiente validado:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

`npm start` abre HTTP local em `http://127.0.0.1:4173/`; deixe a porta livre ao executar Playwright. O HTML é autônomo. A cópia de distribuição é `origens-v0.8.html`; o ZIP contém HTML e relatório. `npm run format` não foi executado sobre o jogo inteiro.

## Arquivos da entrega

Criados: `ORIGENS — Survival v0.8.html`, `origens-v0.8.html`, `origens-v0.8.zip`, `RELATORIO-v0.8.md`, `relatorio-v0.8.md`, `tests/storage.test.cjs`, `tests/e2e/storage.spec.js`, `tests/e2e/navigation.js` e a pasta de evidências `evidencias-v0.8/`.

Modificados: `.prettierignore`, `README.md`, `eslint.config.mjs`, `package.json`, `package-lock.json`, `scripts/serve.cjs`, `tests/e2e/fixtures.js`, `tests/e2e/origens.spec.js`, `tests/e2e/inventory.spec.js`, `tests/e2e/crafting.spec.js`.

O lockfile mudou apenas o número de versão; dependências foram preservadas. Hashes dos artefatos históricos foram conferidos e nenhum mudou. Gerador e arte anterior foram comparados byte a byte com a v0.7. `node_modules`, resultados temporários e traces não foram adicionados ao Git.

## Evidências

As capturas da interface foram inspecionadas em 1280×800 e 390×844; o teste também validou 640×480. As duas capturas de falha são da primeira execução, mantidas para rastreabilidade.

- [bau-1280x800.png](evidencias-v0.8/bau-1280x800.png)
- [bau-390x844.png](evidencias-v0.8/bau-390x844.png)
- [bau-640x480.png](evidencias-v0.8/bau-640x480.png)
- [ciclo-completo-isolado.txt](evidencias-v0.8/ciclo-completo-isolado.txt)
- [eslint.txt](evidencias-v0.8/eslint.txt)
- [falha-inicial-ciclo.png](evidencias-v0.8/falha-inicial-ciclo.png)
- [falha-inicial-interface.png](evidencias-v0.8/falha-inicial-interface.png)
- [navegador-final.txt](evidencias-v0.8/navegador-final.txt)
- [prettier.txt](evidencias-v0.8/prettier.txt)
- [previa-posicionamento.png](evidencias-v0.8/previa-posicionamento.png)
- [primeira-execucao.txt](evidencias-v0.8/primeira-execucao.txt)

## Matriz dos critérios da etapa 0.8

V = script real v0.8 em VM (pintura DOM substituída); B = Chromium com eventos e pixels reais. A tabela descreve verificações agrupadas, não 115 casos independentes do runner.

| Nº  | Critério                                                                           | Evidência                                                      |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 01  | Baú de Madeira existe no catálogo.                                                 | V: tests/storage.test.cjs                                      |
| 02  | item possui categoria correta.                                                     | V: tests/storage.test.cjs                                      |
| 03  | baú como item possui limite de pilha igual a 1.                                    | V: tests/storage.test.cjs                                      |
| 04  | receita utiliza os ingredientes definidos.                                         | V: tests/storage.test.cjs                                      |
| 05  | fabricação consome os materiais corretos.                                          | V: tests/storage.test.cjs                                      |
| 06  | resultado ocupa um slot.                                                           | V: tests/storage.test.cjs                                      |
| 07  | dois baús fabricados não são empilhados.                                           | V: tests/storage.test.cjs                                      |
| 08  | falta de ingredientes impede fabricação.                                           | V: tests/storage.test.cjs                                      |
| 09  | inventário cheio impede fabricação quando não há espaço.                           | V: tests/storage.test.cjs                                      |
| 10  | consumo que libera espaço permite fabricação.                                      | V: tests/storage.test.cjs                                      |
| 11  | fabricação rejeitada não consome materiais.                                        | V: tests/storage.test.cjs                                      |
| 12  | receitas anteriores continuam funcionando.                                         | V: tests/storage.test.cjs                                      |
| 13  | selecionar baú pela hotbar.                                                        | V: tests/storage.test.cjs                                      |
| 14  | exibir pré-visualização.                                                           | V: tests/storage.test.cjs; B: prévia e raster nos quatro zooms |
| 15  | pré-visualização respeita câmera.                                                  | V: tests/storage.test.cjs; B: prévia e raster nos quatro zooms |
| 16  | pré-visualização respeita zoom.                                                    | V: tests/storage.test.cjs; B: prévia e raster nos quatro zooms |
| 17  | posicionar em terreno permitido.                                                   | V: tests/storage.test.cjs                                      |
| 18  | consumir exatamente um baú.                                                        | V: tests/storage.test.cjs                                      |
| 19  | impedir posicionamento em água.                                                    | V: tests/storage.test.cjs                                      |
| 20  | impedir posicionamento em lava.                                                    | V: tests/storage.test.cjs                                      |
| 21  | impedir posicionamento em árvore.                                                  | V: tests/storage.test.cjs                                      |
| 22  | impedir posicionamento em rocha.                                                   | V: tests/storage.test.cjs                                      |
| 23  | impedir posicionamento sobre outro baú.                                            | V: tests/storage.test.cjs                                      |
| 24  | impedir posicionamento sobre o personagem.                                         | V: tests/storage.test.cjs                                      |
| 25  | impedir posicionamento fora do mapa.                                               | V: tests/storage.test.cjs                                      |
| 26  | impedir posicionamento fora do alcance.                                            | V: tests/storage.test.cjs                                      |
| 27  | impedir posicionamento durante navegação.                                          | V: tests/storage.test.cjs                                      |
| 28  | impedir posicionamento através de menus.                                           | V: tests/storage.test.cjs                                      |
| 29  | impedir dois baús no mesmo tile.                                                   | V: tests/storage.test.cjs                                      |
| 30  | impedir criação sem consumir o item.                                               | V: tests/storage.test.cjs                                      |
| 31  | baú possui colisão.                                                                | V: tests/storage.test.cjs                                      |
| 32  | personagem não atravessa baú.                                                      | V: tests/storage.test.cjs                                      |
| 33  | jogador consegue aproximar-se para interagir.                                      | V: tests/storage.test.cjs                                      |
| 34  | tecla F abre baú próximo.                                                          | V: tests/storage.test.cjs                                      |
| 35  | tecla F não abre baú distante.                                                     | V: tests/storage.test.cjs                                      |
| 36  | interação respeita obstáculos.                                                     | V: tests/storage.test.cjs                                      |
| 37  | entre dois baús próximos, abrir somente o escolhido pela regra de proximidade.     | V: tests/storage.test.cjs                                      |
| 38  | interface mostra 27 slots.                                                         | B: grade de 27 espaços                                         |
| 39  | baús diferentes possuem IDs diferentes.                                            | V: tests/storage.test.cjs                                      |
| 40  | baús diferentes possuem inventários independentes.                                 | V: tests/storage.test.cjs                                      |
| 41  | mover madeira do inventário para o baú.                                            | V: tests/storage.test.cjs                                      |
| 42  | retirar madeira do baú.                                                            | V: tests/storage.test.cjs                                      |
| 43  | mover pedra.                                                                       | V: tests/storage.test.cjs                                      |
| 44  | mover minério.                                                                     | V: tests/storage.test.cjs                                      |
| 45  | mover machado.                                                                     | V: tests/storage.test.cjs                                      |
| 46  | mover picareta.                                                                    | V: tests/storage.test.cjs                                      |
| 47  | mover mochila não utilizada.                                                       | V: tests/storage.test.cjs                                      |
| 48  | dividir pilha no baú.                                                              | V: tests/storage.test.cjs                                      |
| 49  | agrupar pilhas iguais.                                                             | V: tests/storage.test.cjs                                      |
| 50  | trocar itens diferentes.                                                           | V: tests/storage.test.cjs                                      |
| 51  | respeitar limite de 200.                                                           | V: tests/storage.test.cjs                                      |
| 52  | impedir pilha com duas ferramentas.                                                | V: tests/storage.test.cjs                                      |
| 53  | transferência rápida do jogador para o baú.                                        | V: tests/storage.test.cjs                                      |
| 54  | transferência rápida do baú para o jogador.                                        | V: tests/storage.test.cjs                                      |
| 55  | transferência parcial preserva excedente.                                          | V: tests/storage.test.cjs                                      |
| 56  | destino cheio preserva item na origem.                                             | V: tests/storage.test.cjs                                      |
| 57  | cursor ocupado não gera segunda pilha.                                             | V: tests/storage.test.cjs                                      |
| 58  | fechar baú com item no cursor não perde materiais.                                 | V: tests/storage.test.cjs                                      |
| 59  | cliques rápidos não duplicam itens.                                                | V: tests/storage.test.cjs                                      |
| 60  | total de cada item permanece constante durante reorganização.                      | V: tests/storage.test.cjs                                      |
| 61  | transferir para inventário inicial de 16 slots.                                    | V: tests/storage.test.cjs                                      |
| 62  | transferir para inventário expandido de 24 slots, se implementado.                 | V: tests/storage.test.cjs                                      |
| 63  | transferir para inventário expandido de 32 slots, se implementado.                 | V: tests/storage.test.cjs                                      |
| 64  | limite de capacidade é respeitado.                                                 | V: tests/storage.test.cjs                                      |
| 65  | hotbar continua com nove atalhos.                                                  | V: tests/storage.test.cjs                                      |
| 66  | ferramenta retirada para o baú deixa de estar equipada quando seu slot fica vazio. | V: tests/storage.test.cjs                                      |
| 67  | baú não altera nível da mochila.                                                   | V: tests/storage.test.cjs                                      |
| 68  | mochila não altera capacidade do baú.                                              | V: tests/storage.test.cjs                                      |
| 69  | baú colocado permanece no mundo.                                                   | V: tests/storage.test.cjs                                      |
| 70  | posição do baú é preservada.                                                       | V: tests/storage.test.cjs                                      |
| 71  | conteúdo é preservado.                                                             | V: tests/storage.test.cjs                                      |
| 72  | ordem dos itens é preservada.                                                      | V: tests/storage.test.cjs                                      |
| 73  | quantidades são preservadas.                                                       | V: tests/storage.test.cjs                                      |
| 74  | múltiplos baús são restaurados.                                                    | V: tests/storage.test.cjs                                      |
| 75  | IDs permanecem estáveis.                                                           | V: tests/storage.test.cjs                                      |
| 76  | mundos diferentes não compartilham baús.                                           | V: tests/storage.test.cjs                                      |
| 77  | mundos com a mesma seed mantêm armazenamento independente.                         | V: tests/storage.test.cjs                                      |
| 78  | mundo antigo carrega sem baús.                                                     | V: tests/storage.test.cjs                                      |
| 79  | baú vazio continua existindo após recarregar.                                      | V: tests/storage.test.cjs                                      |
| 80  | transferência seguida de salvamento não duplica itens.                             | V: tests/storage.test.cjs                                      |
| 81  | fechamento inesperado preserva estado recuperável.                                 | V: tests/storage.test.cjs                                      |
| 82  | erro de salvamento é informado.                                                    | V: tests/storage.test.cjs                                      |
| 83  | dados inconsistentes não sobrescrevem silenciosamente saves íntegros.              | V: tests/storage.test.cjs                                      |
| 84  | abertura de baú não recria inventário vazio.                                       | V: tests/storage.test.cjs                                      |
| 85  | recolher baú vazio.                                                                | V: tests/storage.test.cjs                                      |
| 86  | item de baú retorna ao inventário.                                                 | V: tests/storage.test.cjs                                      |
| 87  | colisão desaparece.                                                                | V: tests/storage.test.cjs                                      |
| 88  | registro persistente é removido.                                                   | V: tests/storage.test.cjs                                      |
| 89  | baú cheio não pode ser recolhido.                                                  | V: tests/storage.test.cjs                                      |
| 90  | baú cheio não perde conteúdos.                                                     | V: tests/storage.test.cjs                                      |
| 91  | inventário cheio impede recolher baú quando o item não cabe.                       | V: tests/storage.test.cjs                                      |
| 92  | clicar rapidamente em recolher não cria dois itens.                                | V: tests/storage.test.cjs                                      |
| 93  | baú removido não reaparece após recarregar.                                        | V: tests/storage.test.cjs                                      |
| 94  | baú recolhido pode ser colocado novamente.                                         | V: tests/storage.test.cjs                                      |
| 95  | WASD funciona.                                                                     | V: tests/storage.test.cjs                                      |
| 96  | câmera funciona.                                                                   | V: tests/storage.test.cjs                                      |
| 97  | zoom funciona.                                                                     | V: tests/storage.test.cjs                                      |
| 98  | jangada funciona.                                                                  | V: tests/storage.test.cjs                                      |
| 99  | mapa e minimapa funcionam.                                                         | B: mapa e minimapa                                             |
| 100 | geração procedural continua consistente.                                           | V: tests/storage.test.cjs                                      |
| 101 | coleta de árvores funciona.                                                        | V: tests/storage.test.cjs                                      |
| 102 | coleta de rochas funciona.                                                         | V: tests/storage.test.cjs                                      |
| 103 | coleta de minérios funciona.                                                       | V: tests/storage.test.cjs                                      |
| 104 | machado funciona.                                                                  | V: tests/storage.test.cjs                                      |
| 105 | picareta funciona.                                                                 | V: tests/storage.test.cjs                                      |
| 106 | crafting básico funciona.                                                          | V: tests/storage.test.cjs                                      |
| 107 | fabricação de ferramentas funciona.                                                | V: tests/storage.test.cjs                                      |
| 108 | mochilas funcionam, quando implementadas.                                          | V: tests/storage.test.cjs                                      |
| 109 | inventário abre com I.                                                             | V: tests/storage.test.cjs                                      |
| 110 | crafting abre com C.                                                               | V: tests/storage.test.cjs                                      |
| 111 | barra rápida funciona de 1 a 9.                                                    | V: tests/storage.test.cjs                                      |
| 112 | objetos destruídos permanecem destruídos.                                          | V: tests/storage.test.cjs                                      |
| 113 | drops continuam persistentes.                                                      | V: tests/storage.test.cjs                                      |
| 114 | mundo antigo continua carregável.                                                  | V: tests/storage.test.cjs                                      |
| 115 | não existem erros relevantes no console durante os fluxos principais.              | B: fixture monitora erros em todos os casos                    |
