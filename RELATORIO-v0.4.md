# ORIGENS — Survival v0.4

## Entrega e diagnóstico

Entrada atual: **ORIGENS — Survival v0.4.html**, HTML único e autônomo, sem dependências ou assets externos para jogar. A v0.3 foi preservada integralmente como cópia de segurança; a v0.2 original também permanece intacta.

A inspeção confirmou coleta funcional em `hitResource`, `destroyResource` e `collectDrops`; objetos em `w.ob`, drops em `G.collection.drops`, câmera em `G.cx/G.cy`, loop `frame/update/draw`, colisão em `blocked`, jangada em `toggleBoat`, mapa/minimapa Canvas e saves por ID em `origens_w_<id>`. Esses sistemas foram reutilizados. O menu continua sendo DOM; o mundo continua em Canvas 960×540.

O bloco de geração, seed/ruído e `GEN=2`, assim como o bloco de arte pixel original, foram comparados e permaneceram byte a byte idênticos à v0.3. Não foi adicionado sistema de chunks.

## Como usar

- `I`: abre/fecha o inventário de **16 slots, em 4×4**.
- Esquerdo: pega uma pilha inteira, coloca em slot vazio, junta pilhas iguais ou troca materiais diferentes.
- Direito: pega metade arredondada para cima; com pilha no cursor, coloca uma unidade em espaço vazio/compatível.
- `1`–`9` ou clique na barra: seleciona um dos nove atalhos, sem consumir ou usar materiais.
- Cada pilha tem no máximo **200 unidades**. A barra consulta os primeiros nove slots; não armazena cópias nem cria capacidade extra.
- Ao fechar segurando itens, o jogo completa pilhas compatíveis e depois usa espaços vazios. Se não couber tudo, mantém a mochila aberta e a pilha protegida no cursor.

Com a mochila aberta, movimento, extração e jangada ficam bloqueados; teclas mantidas não retomam o movimento sem nova entrada. A câmera fica estável. `E` continua reservado à jangada com a interface fechada. O mapa `M`, zoom, minimapa e debug continuam disponíveis na exploração; mapa e inventário não recebem cliques simultaneamente. A barra permanece visível na exploração e na jangada e fica oculta no menu/mapa.

O painel oferece nomes/quantidades por tooltip, capacidade ocupada, ícones CSS provisórios e cursor visual que não intercepta cliques. O layout independe do zoom/câmera, reserva espaço para a barra e permite rolagem em telas menores. Não há imagens novas externas.

## Modelo e conservação

`G.inventory` contém:

```text
slots: exatamente 16 posições, cada uma null ou {itemId, quantity}
cursor: null ou uma pilha pendente de colocação
selected: índice de 0 a 8
pending: {wood, stone, ore}, somente recuperação/migração
migrationVersion: 1
```

`ITEM_TYPES` mantém os únicos materiais atuais: madeira (`wood`), pedra (`stone`) e minério bruto (`ore`). `INVENTORY_SIZE=16`, `DEFAULT_MAX_STACK=200` e `HOTBAR_SIZE=9` centralizam os limites.

`addItems` prioriza pilhas incompletas e depois slots vazios; retorna a quantidade que não couber. `inventorySlotClick`, `returnInventoryCursor`, `selectInventorySlot`, `inventoryCapacity`, `inventoryTotals`, `restoreInventory` e `serializeInventory` separam operações, consultas e persistência. Pilhas são copiadas, sem compartilhar objetos entre posições. Operações inválidas são rejeitadas.

O HUD calcula totais a partir dos slots e do cursor. `collection.materials` é somente uma visão derivada de compatibilidade, sem fonte independente nem contadores duplicados no save v4. Os materiais pendentes aparecem separadamente no painel.

`pending` não recebe coleta comum e não representa slots extras. É uma reserva explícita para excedentes de saves antigos e recuperação de registros conhecidos malformados. O botão transfere somente o que couber, reduzindo a reserva na mesma operação. Se não houver capacidade, o excedente permanece salvo; não é apagado nem disponibilizado pela barra rápida.

## Integração com coleta

Árvores continuam exigindo 3 golpes e produzindo 3 madeiras; pedras, 4 golpes e 2 pedras; cristais, 5 golpes e 1 minério. Alcance de 80 px, intervalo de 350 ms, recolhimento a 24 px, bloqueios por água/sólidos, colisão e proibição de coleta na jangada foram mantidos.

O recolhimento consulta capacidade, insere apenas a parte aceita e depois reduz ou remove o drop. Exemplo realmente exercitado no navegador: drop natural de 3 madeiras, espaço para 2, inserção de 2 e saldo de 1 no chão, inclusive após salvar/recarregar. A validação de restauração agora aceita esse saldo positivo até a quantidade original do nó.

As operações são síncronas: inventário e drop terminam a transação antes de qualquer save ou atualização da interface. Assim, o save não registra simultaneamente a quantidade original no drop e a quantidade já inserida nos slots.

## Save v4 e migração

O esquema passou explicitamente para **`v:4`**, mantendo **`gv:2`**, IDs, seeds e chaves de armazenamento. O índice continua em `origens_idx_v2`. O save contém `id`, posição, jangada, exploração, coleção esparsa e `inventory`. Nenhum mapa completo é serializado.

Saves v2/v3 continuam aceitos. No v3, os contadores são convertidos uma vez em pilhas de até 200; o excesso fica em `pending`. Saves v4 restauram diretamente seu inventário e nunca reimportam os contadores antigos, mesmo se esses campos ainda existirem. O exemplo 230 madeiras/65 pedras/3 minérios foi verificado como 200+30, 65 e 3, sem duplicação em cargas repetidas.

Antes da primeira atualização, a cópia original é preservada em `origens_w_<id>_backup_v2` ou `_backup_v3`. Se o backup não puder ser gravado, o save anterior é preservado e a falha é informada. A exclusão confirmada de um mundo remove seus backups associados. O caminho de migração v1 foi preservado; a chave `origens_save_v1` não é apagada. Saves do gerador antigo `gv:1` continuam sujeitos à regra preexistente de reiniciar posição/exploração, com aviso, porque se referem a outro gerador.

Slots, organização, seleção, cursor e reserva são salvos por mundo. Dados inválidos são tratados por entrada, sem apagar vizinhos legítimos ou o mundo inteiro; quantidades conhecidas acima de 200 são reorganizadas, com excedentes preservados em recuperação. Itens desconhecidos, quantidades inválidas e coordenadas impróprias não são aplicados.

Alterações importantes agendam uma gravação com debounce de 600 ms, além do autosave existente a cada 10 segundos. Menu, ocultação de aba e `pagehide` também salvam. Não há escrita de localStorage por frame. Uma recarga real enquanto o cursor carregava 200 madeiras recuperou a pilha uma vez e reabriu a mochila. Falhas de escrita mantêm o estado em memória e mostram uma mensagem de erro.

## Testes executados

Ambiente: Node 24.22.1, Playwright 1.65.0 e Chromium 155.0.8059.79 instalado no sistema.

| Suíte                                                        | Resultado                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| Coleta/geração histórica (`tests/collection.test.cjs`)       | 29 grupos aprovados                                        |
| Inventário e integração v0.4 (`tests/inventory.test.cjs`)    | 42 grupos aprovados                                        |
| Playwright, incluindo regressões e 10 cenários de inventário | 18 aprovados, 0 reprovados, 1 ignorado                     |
| ESLint                                                       | 12 arquivos analisados, 0 erros e 0 avisos                 |
| Prettier check                                               | Código 1: divergências de estilo preservadas em 8 arquivos |

O único teste ignorado é a escolha de origem elemental, que não existe no jogo e não faz parte dos 60 critérios do inventário. Nenhum dos 60 critérios ficou sem execução. O detalhamento aparece na tabela ao final deste relatório.

Comandos efetivamente executados:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
node tests/inventory.test.cjs
npm run lint -- --format json --output-file /tmp/origens-v04-final-eslint.json
npm run format:check
```

A execução completa `npm test` passou; a suíte de inventário foi executada novamente depois de acrescentar uma verificação de compatibilidade v1/v2, fechando os 42 grupos atuais. O Playwright final aprovou 18 testes em aproximadamente 21,5 segundos. As falhas de quota simuladas são resultados esperados dentro de testes aprovados, não falhas não resolvidas.

A lógica é testada a partir do modelo real embutido no HTML. No realm VM de integração, somente a renderização DOM é substituída por stubs; coleta, movimento, save e restauração continuam reais. Há 1.500 operações determinísticas com invariantes de quantidade e testes de conservação entre slots, cursor, drops e reserva.

Os testes Chromium usam eventos reais de mouse/teclado, DOM, pixels do Canvas e recargas reais. Alguns cenários posicionam o personagem ao lado de recursos/costa e inserem materiais como fixtures controladas; não representam uma partida inteira percorrida manualmente. A extração dos três tipos, a manipulação das pilhas e a persistência são efetivamente executadas. O cenário de recuperação também verifica o botão de reserva, a transferência parcial e a recarga sem duplicação.

Foi inspecionada a captura `/tmp/origens-v04-ui.png`, com os três materiais, quantidades 199/200, grade 4×4 e nove atalhos. Ela é evidência de teste, não asset necessário para jogar. A fixture verifica erros JavaScript, console, requisições e respostas HTTP em todos os fluxos; não detectou erros inesperados na execução final.

As divergências do Prettier estão no HTML atual, configuração Playwright, dois relatórios históricos e quatro arquivos de testes anteriores. Não foi reformatado o gerador nem o jogo inteiro para obter resultado verde. Novos testes e arquivos auxiliares alterados foram formatados de forma pontual.

## Problemas tratados e limites

- A validação antiga exigia a quantidade integral de cada drop; foi adaptada para conservar saldos após coleta parcial.
- Cursor pendente, devolução incompleta e contadores antigos foram tratados como estados persistentes, evitando perda e reimportação.
- A interface reserva espaço para a barra em janelas menores e limpa tooltip ao fechar, abrir mapa ou trocar de mundo.
- O roteamento de teclado limpa teclas mantidas e ignora repetições, evitando movimento residual após fechar a mochila.
- A seleção de atalhos rejeita objetos de inventário inválidos, além de índices fora de 0–8.
- A cópia anterior e o progresso em memória são preservados quando a gravação falha.

Não há falhas conhecidas nos cenários finais testados. Não houve campanha manual prolongada, teste em outros navegadores, controles mobile ou testes de encerramento forçado do processo/queda de energia. O salvamento em `pagehide` e recarga real foram verificados; um navegador morto antes de qualquer evento de gravação não oferece garantia de persistência.

O Chromium gerenciado deste ambiente bloqueia URLs `file://`, então a validação real usou o servidor HTTP local configurado. O arquivo entregue continua autônomo. Navegadores podem separar localStorage por origem e até por arquivo local; para reencontrar os mesmos saves, use o mesmo perfil/origem. O servidor agora entrega a v0.4 na mesma rota inicial, sem perder a origem dos saves de testes anteriores.

Não foram implementados crafting, receitas, baús, consumo/uso de itens, ferramentas, equipamentos, combate novo, expansão/fabricação de mochilas, peso ou novos recursos. Esses sistemas ficam para etapas futuras.

## Arquivos

Criados:

- `ORIGENS — Survival v0.4.html`
- `tests/inventory.test.cjs`
- `tests/e2e/inventory.spec.js`
- `RELATORIO-v0.4.md`

Modificados:

- `scripts/serve.cjs`: entrada v0.4, mantendo as versões anteriores disponíveis.
- `tests/e2e/fixtures.js`: título da versão atual.
- `tests/e2e/origens.spec.js`: expectativa do save v4.
- `package.json` / `package-lock.json`: versão 0.4.0 e inclusão da suíte Node de inventário, sem dependências novas.
- `eslint.config.mjs`: globais reais usados nos callbacks de testes, limitados ao E2E.
- `.prettierignore`: v0.3 preservada como versão histórica.
- `README.md`: entrada, controles, persistência e testes da v0.4.

Os HTMLs v0.2/v0.3 e os testes históricos de coleta/CDP não foram alterados. Hashes preservados:

```text
20e5d3613dfe78a8c995794cb59dbb81797c6bb0c56364b878be43a5cb14ad99  ORIGENS — Mundo Procedural v0.2.html
3e03c4833cb87fb4df321a9df77fb4f4878a6b798abff2d039065b76182c3ba7  ORIGENS — Survival v0.3.html
```

## Reexecutar

```sh
npm ci
npm run test:unit
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run lint
```

Em máquinas sem Chromium instalado, prepare o navegador com `npm run test:e2e:install` e rode `npm run test:e2e` sem a variável de executável. O servidor é iniciado/encerrado pelo Playwright. Para servir o jogo, `npm start`; para jogar diretamente, abra o HTML entregue em um navegador local que permita arquivos.

## Evidências por critério solicitado

**L** = modelo/integração real no Node/VM; **B** = Chromium real com Playwright. Os casos são agrupados nas suítes; um grupo pode verificar vários critérios, sem contabilizar testes não executados como aprovados.

| Critério | Verificação                                                                                                            | Resultado | Evidência |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| 01       | criar inventário vazio e verificar que possui exatamente 16 slots.                                                     | Aprovado  | L + B     |
| 02       | verificar que todos os slots começam vazios em um mundo novo.                                                          | Aprovado  | L + B     |
| 03       | garantir que não existam slots ocultos adicionais.                                                                     | Aprovado  | L + B     |
| 04       | verificar que cada pilha contém identificador e quantidade válidos.                                                    | Aprovado  | L + B     |
| 05       | garantir que não existem pilhas com quantidade zero ou negativa.                                                       | Aprovado  | L + B     |
| 06       | inserir uma madeira em inventário vazio.                                                                               | Aprovado  | L         |
| 07       | inserir 200 madeiras em inventário vazio.                                                                              | Aprovado  | L         |
| 08       | inserir 201 madeiras e verificar duas pilhas: 200 e 1.                                                                 | Aprovado  | L         |
| 09       | inserir 450 madeiras e verificar três pilhas: 200, 200 e 50.                                                           | Aprovado  | L         |
| 10       | inserir madeira, pedra e minério, verificando separação por tipo.                                                      | Aprovado  | L         |
| 11       | completar uma pilha de 190 com mais 10 unidades.                                                                       | Aprovado  | L         |
| 12       | completar uma pilha de 190 recebendo 30 e colocar 20 em outro espaço.                                                  | Aprovado  | L         |
| 13       | preencher todas as 16 posições e verificar que não é criado um décimo sétimo slot.                                     | Aprovado  | L + B     |
| 14       | tentar inserir material com inventário cheio e verificar que o excedente é retornado.                                  | Aprovado  | L + B     |
| 15       | pegar pilha inteira com clique esquerdo.                                                                               | Aprovado  | L + B     |
| 16       | colocar pilha em slot vazio.                                                                                           | Aprovado  | L + B     |
| 17       | trocar madeira por pedra.                                                                                              | Aprovado  | L + B     |
| 18       | juntar pilhas iguais.                                                                                                  | Aprovado  | L + B     |
| 19       | juntar pilhas iguais sem ultrapassar 200.                                                                              | Aprovado  | L + B     |
| 20       | verificar que o excedente permanece no cursor.                                                                         | Aprovado  | L + B     |
| 21       | dividir pilha com quantidade par.                                                                                      | Aprovado  | L         |
| 22       | dividir pilha com quantidade ímpar.                                                                                    | Aprovado  | L + B     |
| 23       | dividir pilha de apenas uma unidade.                                                                                   | Aprovado  | L         |
| 24       | colocar uma unidade por clique direito.                                                                                | Aprovado  | L + B     |
| 25       | impedir clique direito de acrescentar item em pilha cheia.                                                             | Aprovado  | L + B     |
| 26       | impedir mistura de materiais diferentes.                                                                               | Aprovado  | L + B     |
| 27       | fechar o inventário segurando uma pilha e verificar que não desaparece.                                                | Aprovado  | L + B     |
| 28       | salvar enquanto existe uma pilha pendente no cursor e confirmar que ela é recuperada sem duplicação.                   | Aprovado  | L + B     |
| 29       | confirmar que existem exatamente nove posições na barra inferior.                                                      | Aprovado  | B         |
| 30       | pressionar as teclas de 1 a 9 e verificar a seleção correspondente.                                                    | Aprovado  | L + B     |
| 31       | confirmar que o conteúdo da barra corresponde aos primeiros nove slots do inventário.                                  | Aprovado  | L + B     |
| 32       | mover um item do primeiro slot para o décimo segundo e verificar que desaparece da barra.                              | Aprovado  | B         |
| 33       | mover item para um slot associado à barra e verificar atualização imediata.                                            | Aprovado  | B         |
| 34       | confirmar que a barra não aumenta a capacidade total de armazenamento.                                                 | Aprovado  | L + B     |
| 35       | confirmar que selecionar slot não consome ou utiliza materiais.                                                        | Aprovado  | L + B     |
| 36       | destruir uma árvore e coletar madeira no inventário.                                                                   | Aprovado  | L + B     |
| 37       | destruir uma pedra e coletar o material correspondente.                                                                | Aprovado  | L + B     |
| 38       | coletar minério.                                                                                                       | Aprovado  | L + B     |
| 39       | coletar parcialmente um drop quando não houver espaço suficiente.                                                      | Aprovado  | L + B     |
| 40       | confirmar que o restante permanece no chão.                                                                            | Aprovado  | L + B     |
| 41       | confirmar que um drop não pode ser recolhido duas vezes.                                                               | Aprovado  | L + B     |
| 42       | confirmar que a coleta não funciona acidentalmente através da interface aberta.                                        | Aprovado  | L + B     |
| 43       | salvar um inventário contendo vários materiais e verificar as quantidades após carregar.                               | Aprovado  | L + B     |
| 44       | salvar pilhas distribuídas em posições específicas e verificar que a organização é restaurada.                         | Aprovado  | L + B     |
| 45       | confirmar que o atalho selecionado é restaurado.                                                                       | Aprovado  | L + B     |
| 46       | alternar entre dois mundos e confirmar inventários independentes.                                                      | Aprovado  | L + B     |
| 47       | criar dois mundos com a mesma seed e verificar que seus inventários não são compartilhados.                            | Aprovado  | L + B     |
| 48       | migrar um salvamento antigo contendo contadores de recursos.                                                           | Aprovado  | L + B     |
| 49       | carregar o mesmo mundo migrado duas vezes sem duplicar itens.                                                          | Aprovado  | L + B     |
| 50       | simular um registro inválido de inventário e verificar que o carregamento trata o problema sem apagar o mundo inteiro. | Aprovado  | L         |
| 51       | movimentação WASD com inventário fechado.                                                                              | Aprovado  | L + B     |
| 52       | inventário aberto impedindo comandos indevidos de movimentação.                                                        | Aprovado  | L + B     |
| 53       | câmera e renderização funcionando após abrir e fechar a interface repetidamente.                                       | Aprovado  | L + B     |
| 54       | jangada funcionando corretamente após a atualização.                                                                   | Aprovado  | B         |
| 55       | mapa e minimapa funcionando.                                                                                           | Aprovado  | B         |
| 56       | objetos destruídos permanecendo destruídos após salvar e carregar.                                                     | Aprovado  | L + B     |
| 57       | drops no chão permanecendo salvos.                                                                                     | Aprovado  | L + B     |
| 58       | nenhum erro de JavaScript no console durante os fluxos principais.                                                     | Aprovado  | B         |
| 59       | nenhum recurso duplicado depois de arrastar itens repetidamente.                                                       | Aprovado  | L + B     |
| 60       | quantidade total de materiais preservada após uma sequência de dividir, mover, juntar, trocar, salvar e carregar.      | Aprovado  | L + B     |
