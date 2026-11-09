# ORIGENS v0.7 — ferramentas e mochilas preservadas

## Base recebida e escopo

O usuário enviou `files.zip` e depois colou o HTML da v0.7, informando que já havia feito duas alterações. Foram identificadas ferramentas primitivas e expansão por mochilas. O ZIP contém dois nomes para o mesmo HTML; o texto colado difere apenas em espaços em branco. A base adotada foi o HTML do ZIP, sem recriar esses sistemas nem voltar à v0.5.

O original está em [backups/origens-v0.7-recebido.html](backups/origens-v0.7-recebido.html), com SHA-256 `47c6bd94603652550b6b6e694728e0ddb05d37ece6700007f3e00a3f545e6ac4`. Os 13 artefatos anteriores v0.2–v0.5 tiveram seus hashes conferidos e continuam idênticos. As mochilas da v0.7 foram preservadas como alteração posterior do usuário; a regra inicial da etapa 0.6 de não criar expansões não foi usada para apagar seu trabalho.

## Auditoria do código real

- O jogo é um único HTML com CSS e JavaScript inline, Canvas 2D de 960×540 e arte gerada por código. Sem recursos gráficos externos.
- A entrada HTTP agora é `ORIGENS — Survival v0.7.html`; a versão publicada é uma cópia idêntica, `origens-v0.7.html`. `npm start` usa o servidor Node já existente, porta 4173, sem dependência de runtime.
- A v0.5 anterior foi conferida pelas suítes históricas e pelas cinco receitas exercitadas também na versão atual. A base recebida passou 113 grupos Node históricos e 30 testes Chromium antes dos ajustes desta entrega.
- O inventário começa com 16 slots, grade 4×4. As mochilas enviadas expandem para 24 e 32. A barra possui exatamente nove atalhos para os slots 0–8 do mesmo array; não armazena cópias.
- Madeira, pedra e minério usam drops naturais, coleta automática, capacidade parcial e excedente no chão. Materiais possuem limite 200; ferramentas e mochilas possuem limite 1.
- Dano parcial fica em `G.collection.damage`, um `Map` por índice do objeto. O save serializa esse mapa como pares `[índice, progresso]`; objetos removidos e drops usam a sobreposição esparsa existente.
- Cliques passam por `cv.onmousedown`, conversão das coordenadas do Canvas, bloqueio de HUD/painéis/mapa/jangada, seleção do recurso, alcance, caminho e cooldown. O clique aceito aplica progresso uma única vez, antes da animação.
- Objetos e jogador são desenhados na ordenação por linhas existente. O jogador usa retângulos em pixel art. As ferramentas são desenhadas junto à mão sob a mesma transformação da câmera.
- `G.view` registra câmera e zoom do desenho. Os quatro fatores são 0,75; 1; 1,25; 1,5. Mira e clique usam essas coordenadas lógicas.
- Os mundos ficam em `localStorage`: índice `origens_idx_v2`, registro `origens_w_<id>`, backups `_backup_v2`, `_backup_v3`, `_backup_v4`. Seeds iguais não compartilham inventários.
- As suítes Node, Playwright, ESLint e Prettier já existiam. Nenhuma dependência ou framework foi acrescentado.
- Não existe tela de escolha de origem elemental. As regiões elementais do gerador existem, mas não equivalem a uma escolha do personagem.

## Funcionalidades recebidas e verificadas

| Item novo         | ID                    | Limite por slot | Função                     |
| ----------------- | --------------------- | --------------- | -------------------------- |
| Machado de Pedra  | `stone_axe`           | 1               | Bônus em árvores           |
| Picareta de Pedra | `stone_pickaxe`       | 1               | Bônus em rochas e minérios |
| Mochila Rústica   | `rustic_backpack`     | 1               | Consumo para 16→24 slots   |
| Mochila Reforçada | `reinforced_backpack` | 1               | Consumo para 24→32 slots   |

Os oito materiais/componentes anteriores mantêm seus IDs: `wood`, `stone`, `ore`, `stick`, `plank`, `chipped_stone`, `simple_handle`, `primitive_component`.

| Receita recebida  | Ingredientes                                   | Resultado                        |
| ----------------- | ---------------------------------------------- | -------------------------------- |
| Machado           | 1 cabo simples + 2 pedras lascadas + 1 graveto | 1 machado                        |
| Picareta          | 1 cabo simples + 3 pedras lascadas + 1 graveto | 1 picareta                       |
| Mochila Rústica   | 12 tábuas + 16 gravetos + 3 cabos simples      | 1 mochila; fabricação no nível 0 |
| Mochila Reforçada | 20 tábuas + 10 peças primitivas + 8 minérios   | 1 mochila; fabricação no nível 1 |

As cinco receitas anteriores continuam no mesmo motor, agora com nove receitas ao todo. A simulação consome ingredientes na cópia dos slots, verifica o resultado inteiro e só então confirma. Cinco ferramentas exigem cinco espaços separados após o consumo. Cursor ocupado, ingredientes insuficientes ou lote sem espaço não consomem materiais. O inventário real mantém sua identidade.

A ferramenta ativa vem diretamente do slot selecionado. Mover o machado ao slot 12 ou 32 retira-o da barra, sem cópia equipada. Item comum, slot vazio ou ferramenta no cursor não conferem bônus. Clique direito preserva a ferramenta inteira.

| Recurso                | Mão ou ferramenta incorreta | Ferramenta correta | Drop, sem bônus de rendimento |
| ---------------------- | --------------------------- | ------------------ | ----------------------------- |
| Árvore, resistência 3  | 3 golpes                    | Machado: 2         | 3 madeiras                    |
| Rocha, resistência 4   | 4 golpes                    | Picareta: 2        | 2 pedras                      |
| Minério, resistência 5 | 5 golpes                    | Picareta: 3        | 1 minério                     |

O golpe especializado aplica 2 pontos; o básico aplica 1. Dano parcial permanece ao trocar de ferramenta ou recarregar. Alcance 80 pixels e intervalo 350 ms foram preservados. Trocar a seleção não reinicia o intervalo. Não há durabilidade, reparo, quebra ou consumo da ferramenta.

## Ajustes feitos nesta entrega

1. Separação do texto de nível/capacidade das instruções do mouse: ambos ocupavam a mesma área CSS e se sobrepunham. A faixa de capacidade ganhou fundo para continuar legível sobre o mapa.
2. A largura do painel acompanha as seis/oito colunas das mochilas no desktop. Em janelas até 720 px, a grade usa quatro colunas com rolagem. Antes, oito colunas tinham slots de 18,8 px em 640×480 para ícones de 31,4 px.
3. O cartão de detalhes inclui mundo e capacidade na chave de atualização, evitando mostrar a capacidade anterior ao trocar de mundo.
4. A ferramenta acompanha aproximadamente a mira do mouse em quatro direções. Antes, seguia apenas a direção do último movimento. Câmera e zoom são considerados sem alterar alcance ou cálculo do dano.
5. O golpe registra a direção visual no instante aceito. A animação de 260 ms usa tempo real, e `save/restore` preserva o contexto do Canvas. O indicador passou de “golpes” para “pts”, pois mostra resistência.
6. Integração da nova entrada e das novas suítes nos scripts existentes. Expectativas dos testes foram atualizadas para nove receitas, catálogo de 12 itens e schema 5, mantendo as verificações anteriores.

Nenhuma receita, resistência, rendimento, progressão, colisão, regra de jangada ou formato de save foi modificado em relação ao ZIP. O gerador, a arte original, os modelos de inventário/crafting e as rotinas de save/carregamento foram comparados com o original recebido e permanecem idênticos.

## Salvamentos e compatibilidade

A v0.7 recebida já utilizava `v:5` e gerador `gv:2`. Isso foi mantido. O registro contém nível da mochila, slots, cursor, seleção, exploração, posição, jangada, dano parcial, recursos removidos e drops; não contém um segundo equipamento.

Saves v2, v3, v4 e v5 são reconhecidos. Os contadores v3 migram uma vez; campos novos ausentes em saves v0.5 não bloqueiam a gravação. Backups antigos são mantidos antes de sobrescrever. Inventários malformados podem ter vizinhos válidos recuperados em memória, enquanto o registro original fica protegido. Falha real de armazenamento é exibida; a alteração em memória continua disponível para tentar salvar novamente.

A compatibilidade é de versões antigas para a atual. A v0.5 não reconhece save v5 nem capacidade expandida. O armazenamento pertence à origem do navegador; abrir em outro domínio ou limpar dados não transfere os mundos automaticamente. O código não foi conectado a saves pessoais do usuário durante os testes.

## Validação executada

Ambiente: Node 24.22.1, npm 11.9.0, Playwright Test 1.65.0, Chromium 155.0.8059.79 em Linux, dois workers, sem retries.

| Suíte                                        | Resultado real                                              | Código exercitado                                                         |
| -------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Coleta/geração Node                          | 29 grupos aprovados                                         | Referência v0.3; gerações determinísticas 128/256/512/1024                |
| Inventário Node                              | 42 grupos aprovados                                         | Referência v0.4                                                           |
| Crafting Node                                | 42 grupos aprovados                                         | Referência v0.5                                                           |
| Ferramentas Node                             | 45 grupos aprovados                                         | HTML v0.7 real; 1.200 operações com conservação em 16/24/32 slots         |
| Mochilas Node                                | 23 grupos aprovados                                         | HTML v0.7 real; 9.000 operações com controle independente das quantidades |
| Chromium completo                            | 44 aprovados, 0 reprovados, 1 ignorado                      | HTML v0.7; fluxos atuais, pixels, eventos e armazenamento                 |
| Apresentação após último ajuste de contraste | 6 aprovados, 0 reprovados                                   | Mesmos casos, repetidos após mudança apenas de CSS                        |
| ESLint                                       | 0 erros, 0 avisos                                           | JavaScript do projeto e HTMLs inline                                      |
| Prettier                                     | Código 1: divergências de estilo em 9 arquivos, preservadas | Verificação sem reformatar o jogo                                         |

O `format:check` apontou `ORIGENS — Survival v0.7.html`, `origens-v0.7.html`, `playwright.config.js`, `RELATORIO-PLAYWRIGHT.md`, `RELATORIO-v0.3.md`, `tests/browser.test.cjs`, `tests/collection.test.cjs`, `tests/e2e/fixtures.js` e `tests/e2e/origens.spec.js`. Essa dívida de estilo foi preservada; não foi aplicado formatador à base inteira. Os novos testes e o relatório estão formatados.

Os 181 grupos Node incluem referências históricas: não são apresentados como 181 testes novos da v0.7. As suítes atuais substituem apenas pintura DOM nos testes VM; a execução real do navegador verifica o que essa simulação não demonstra.

O teste da primeira ferramenta começou em mundo vazio, usou busca somente de leitura para planejar caminhos, movimentação real por teclado e cliques reais: duas árvores e uma rocha coletadas, intermediários fabricados, machado fabricado, movido para a barra, selecionado e usado em outra árvore com dois golpes. Depois de recolher o drop e recarregar, itens, seleção e quatro recursos removidos permaneceram corretos. Não houve teleporte, inserção de materiais ou alteração manual de saves nesse cenário. O passo de escolher origem não foi simulado, pois essa funcionalidade está ausente.

Os demais casos incluem fixtures explícitas para bordas: lotes atômicos em inventário cheio, ferramentas no cursor, ingredientes espalhados, troca durante cooldown, dano parcial, rocha e minério com picareta, quota de armazenamento, migração, mundos de mesma seed e navegação com jangada. As ferramentas foram diferenciadas por pixels reais nos quatro níveis de zoom, e a mira por pixels da cabeça à esquerda/direita, além das quatro direções lógicas. Os painéis não golpeiam recursos. A fixture monitora erros JavaScript, console, HTTP e requisições em todos os testes.

Os 100 critérios numerados da etapa 0.6 são relacionados na matriz abaixo; são grupos de verificações, não 100 casos independentes do runner.

## Resultados, falhas e limites

- Na base recebida: 30 testes Chromium e 113 grupos históricos aprovados. A inspeção visual revelou sobreposição e ícones fora das células, mesmo sem erros de console; esses problemas foram corrigidos e ganharam verificações específicas.
- Na execução completa final: 181 grupos Node e 44 testes Chromium aprovados, nenhuma falha. Após o último ajuste de fundo, os seis casos de apresentação foram executados novamente e passaram.
- Durante a autoria dos testes VM, dois fixtures precisaram de correção: tentativa de redefinir um getter não configurável e desenho antes da inicialização de índices do jogador. Uma atribuição sem uso no teste também foi corrigida após o ESLint. Não foram mudanças na jogabilidade.
- Não executado: escolha de origem elemental, registrada como ignorada. A página não possui essa funcionalidade.
- Não executado nesta entrega: outros navegadores, controles por toque e renderização em GPU/dispositivo móvel real. A janela 390×844 é validação de layout no Chromium de desktop, não suporte novo a toque.
- O ambiente falhou inicialmente ao iniciar e impediu leitura dos anexos. Depois de ficar pronto, download, inspeção e testes realmente funcionaram. Chromium precisou da execução permitida fora da sandbox para processos/loopback.
- O host público de preview retornou HTTP 403 no proxy deste ambiente ao ser conferido nesta entrega. O jogo foi testado por HTTP local; o link de preview externo não é apresentado como testado aqui. A cópia publicada deve ter seus bytes conferidos pela URL raw do GitHub.
- Saves corrompidos protegidos não possuem editor/exportador nesta versão; encerramento abrupto antes da gravação não garante recuperação de alterações recentes. Não foi acrescentado servidor de contas ou sincronização de saves.
- As mochilas recebidas podem ser fabricadas em lote antes de usar uma delas; aplicar novamente o mesmo nível é rejeitado. Esse comportamento do arquivo enviado foi preservado.

Ficaram adiados combate, inimigos, armas elementais, durabilidade, reparos, ferramentas avançadas, bancadas, construções, baús, máquinas, agricultura e novos biomas. Não foi criada arte externa nem modificada a geração procedural.

## Evidências visuais e logs

As capturas abaixo foram geradas no Chromium e inspecionadas. Não são imagens de falha:

- [Inventário expandido em 1280×800](evidencias-v0.7/inventario-1280x800.png)
- [Inventário expandido em 640×480](evidencias-v0.7/inventario-640x480.png)
- [Inventário expandido em 390×844](evidencias-v0.7/inventario-390x844.png)
- [Machado na mão acompanhando a mira](evidencias-v0.7/ferramenta-na-mao.png)
- [Log completo da execução](evidencias-v0.7/testes-completos.txt)
- [Revalidação da apresentação](evidencias-v0.7/testes-apresentacao.txt)

## Comandos para repetir

```sh
npm ci
npm run test:e2e:install
npm test
npm run lint
npm run format:check
npm start
```

No ambiente validado, foi usado o Chromium já instalado:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test tests/e2e/presentation.spec.js
```

Também foram executados `node tests/tools.test.cjs`, `node tests/backpack.test.cjs`, lint dos testes novos, verificação dos hashes anteriores e comparação das áreas preservadas com o ZIP. O lockfile foi atualizado offline apenas para o número da versão. `npm run format` não foi aplicado ao jogo. Para jogar localmente com HTTP: `npm start`, abrir `http://127.0.0.1:4173/`. Durante os testes o Playwright gerencia seu próprio servidor; deixe essa porta livre.

## Arquivos criados e modificados

Criados: `ORIGENS — Survival v0.7.html`, `origens-v0.7.html`, `origens-v0.7.zip`, `backups/origens-v0.7-recebido.html`, `tests/tools.test.cjs`, `tests/backpack.test.cjs`, `tests/e2e/tools.spec.js`, `tests/e2e/presentation.spec.js`, `RELATORIO-v0.7.md`, `relatorio-v0.7.md` e os seis arquivos de evidência listados acima.

Modificados: `README.md`, `package.json`, `package-lock.json`, `scripts/serve.cjs`, `eslint.config.mjs`, `.prettierignore`, `tests/e2e/fixtures.js`, `tests/e2e/origens.spec.js`, `tests/e2e/inventory.spec.js`, `tests/e2e/crafting.spec.js`.

O ZIP de entrega contém o HTML autônomo e o relatório. A cópia original recebida e as versões históricas continuam no repositório. Não foram versionados `node_modules`, relatórios temporários do runner ou traces.

## Matriz dos 100 critérios da etapa 0.6

V = `tests/tools.test.cjs`, código atual em VM com somente pintura DOM substituída. B = Chromium com eventos, DOM, pixels e persistência reais. Os testes de mochilas complementam essa matriz, preservando a evolução recebida da v0.7.

| Nº  | Critério solicitado                                                                                    | Evidência executada                                         | Resultado |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------- |
| 01  | machado registrado com ID único.                                                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 02  | picareta registrada com ID único.                                                                      | V: testes de ferramentas e integração atual                 | Aprovado  |
| 03  | machado classificado como ferramenta.                                                                  | V: testes de ferramentas e integração atual                 | Aprovado  |
| 04  | picareta classificada como ferramenta.                                                                 | V: testes de ferramentas e integração atual                 | Aprovado  |
| 05  | ferramentas possuem limite de empilhamento 1.                                                          | V: testes de ferramentas e integração atual                 | Aprovado  |
| 06  | materiais continuam com limite 200.                                                                    | V: testes de ferramentas e integração atual                 | Aprovado  |
| 07  | duas ferramentas iguais ocupam dois slots separados.                                                   | V: testes de ferramentas e integração atual                 | Aprovado  |
| 08  | ferramenta não pode ser dividida em quantidade fracionada.                                             | V: testes de ferramentas e integração atual                 | Aprovado  |
| 09  | ferramenta não pode ser mesclada em pilha de quantidade 2.                                             | V: testes de ferramentas e integração atual                 | Aprovado  |
| 10  | inventário continua com exatamente 16 slots.                                                           | V: testes de ferramentas e integração atual                 | Aprovado  |
| 11  | fabricar machado com ingredientes suficientes.                                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 12  | fabricar picareta com ingredientes suficientes.                                                        | V: testes de ferramentas e integração atual                 | Aprovado  |
| 13  | rejeitar fabricação sem cabo simples.                                                                  | V: testes de ferramentas e integração atual                 | Aprovado  |
| 14  | rejeitar fabricação sem pedras lascadas suficientes.                                                   | V: testes de ferramentas e integração atual                 | Aprovado  |
| 15  | rejeitar fabricação sem graveto.                                                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 16  | consumir somente os ingredientes corretos.                                                             | V: testes de ferramentas e integração atual                 | Aprovado  |
| 17  | produzir exatamente uma ferramenta por execução.                                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 18  | fabricar duas ferramentas iguais e armazená-las separadamente.                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 19  | fabricar com ingredientes distribuídos por vários slots.                                               | V: testes de ferramentas e integração atual                 | Aprovado  |
| 20  | impedir fabricação sem espaço disponível.                                                              | V: testes de ferramentas e integração atual                 | Aprovado  |
| 21  | permitir fabricação quando o consumo liberar espaço.                                                   | V: testes de ferramentas e integração atual                 | Aprovado  |
| 22  | impedir fabricação parcial em lote.                                                                    | V: testes de ferramentas e integração atual                 | Aprovado  |
| 23  | fabricar cinco ferramentas somente quando existirem cinco posições disponíveis após simular o consumo. | V: testes de ferramentas e integração atual                 | Aprovado  |
| 24  | impedir duplicação por cliques rápidos no botão de crafting.                                           | V: testes de ferramentas e integração atual                 | Aprovado  |
| 25  | colocar machado no primeiro slot.                                                                      | V: testes de ferramentas e integração atual                 | Aprovado  |
| 26  | pressionar tecla 1 e verificar machado ativo.                                                          | V: testes de ferramentas e integração atual                 | Aprovado  |
| 27  | colocar picareta no segundo slot.                                                                      | V: testes de ferramentas e integração atual                 | Aprovado  |
| 28  | pressionar tecla 2 e verificar picareta ativa.                                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 29  | selecionar slot vazio e verificar ausência de ferramenta.                                              | V: testes de ferramentas e integração atual                 | Aprovado  |
| 30  | selecionar slot contendo madeira e verificar ausência de bônus de ferramenta.                          | V: testes de ferramentas e integração atual                 | Aprovado  |
| 31  | mover machado do slot 1 para o slot 12.                                                                | V: testes de ferramentas e integração atual                 | Aprovado  |
| 32  | confirmar que machado deixa de estar ativo após sair da posição selecionada.                           | V: testes de ferramentas e integração atual                 | Aprovado  |
| 33  | mover picareta para uma posição da barra e verificar atualização.                                      | V: testes de ferramentas e integração atual                 | Aprovado  |
| 34  | selecionar rapidamente várias posições sem duplicar ferramentas.                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 35  | confirmar que os nove atalhos não adicionam armazenamento.                                             | V: testes de ferramentas e integração atual                 | Aprovado  |
| 36  | confirmar que o slot selecionado permanece destacado corretamente.                                     | B: destaque na barra, movimentação e seleção de ferramentas | Aprovado  |
| 37  | quebrar árvore sem ferramenta no número normal de golpes.                                              | V: testes de ferramentas e integração atual                 | Aprovado  |
| 38  | quebrar árvore com machado no número reduzido de golpes.                                               | V: testes de ferramentas e integração atual                 | Aprovado  |
| 39  | utilizar picareta em árvore sem receber bônus.                                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 40  | quebrar árvore após combinar golpes com mão e machado.                                                 | V: testes de ferramentas e integração atual                 | Aprovado  |
| 41  | garantir que árvore produza a quantidade normal de madeira.                                            | V: testes de ferramentas e integração atual                 | Aprovado  |
| 42  | quebrar rocha sem ferramenta.                                                                          | V: testes de ferramentas e integração atual                 | Aprovado  |
| 43  | quebrar rocha com picareta.                                                                            | V: testes de ferramentas e integração atual                 | Aprovado  |
| 44  | usar machado em rocha sem bônus.                                                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 45  | combinar golpes de picareta e mão na mesma rocha.                                                      | V: testes de ferramentas e integração atual                 | Aprovado  |
| 46  | confirmar que a quantidade de pedra produzida não mudou.                                               | V: testes de ferramentas e integração atual                 | Aprovado  |
| 47  | minerar sem ferramenta, conforme as regras existentes.                                                 | V: testes de ferramentas e integração atual                 | Aprovado  |
| 48  | minerar com picareta recebendo o bônus esperado.                                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 49  | usar machado em minério sem bônus.                                                                     | V: testes de ferramentas e integração atual                 | Aprovado  |
| 50  | confirmar quantidade correta de minério produzido.                                                     | V: testes de ferramentas e integração atual                 | Aprovado  |
| 51  | confirmar que os drops minerais continuam persistentes.                                                | V: testes de ferramentas e integração atual                 | Aprovado  |
| 52  | tentar golpear árvore fora do alcance.                                                                 | V: testes de ferramentas e integração atual                 | Aprovado  |
| 53  | tentar minerar rocha fora do alcance.                                                                  | V: testes de ferramentas e integração atual                 | Aprovado  |
| 54  | clicar rapidamente durante cooldown.                                                                   | V: testes de ferramentas e integração atual                 | Aprovado  |
| 55  | trocar de ferramenta durante cooldown.                                                                 | V: testes de ferramentas e integração atual                 | Aprovado  |
| 56  | trocar de ferramenta durante animação de golpe.                                                        | V: testes de ferramentas e integração atual                 | Aprovado  |
| 57  | abrir inventário durante exploração.                                                                   | V: testes de ferramentas e integração atual                 | Aprovado  |
| 58  | verificar que cliques no inventário não golpeiam objetos.                                              | V: testes de ferramentas e integração atual                 | Aprovado  |
| 59  | abrir crafting e verificar que cliques não atingem recursos.                                           | V: testes de ferramentas e integração atual                 | Aprovado  |
| 60  | verificar que ferramentas não são utilizadas durante navegação na jangada.                             | V: testes de ferramentas e integração atual                 | Aprovado  |
| 61  | verificar que o zoom não altera incorretamente o alcance.                                              | V: testes de ferramentas e integração atual                 | Aprovado  |
| 62  | verificar que a câmera não altera indevidamente o alvo.                                                | V: testes de ferramentas e integração atual                 | Aprovado  |
| 63  | confirmar que a colisão de objetos desaparece após destruição.                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 64  | confirmar que somente um objeto recebe o golpe destinado a ele, conforme a regra de seleção existente. | V: testes de ferramentas e integração atual                 | Aprovado  |
| 65  | fabricar machado, salvar e recarregar.                                                                 | V: testes de ferramentas e integração atual                 | Aprovado  |
| 66  | fabricar picareta, salvar e recarregar.                                                                | V: testes de ferramentas e integração atual                 | Aprovado  |
| 67  | salvar com machado selecionado.                                                                        | V: testes de ferramentas e integração atual                 | Aprovado  |
| 68  | recarregar e confirmar a seleção correta.                                                              | V: testes de ferramentas e integração atual                 | Aprovado  |
| 69  | mover ferramenta para outro slot e salvar.                                                             | V: testes de ferramentas e integração atual                 | Aprovado  |
| 70  | recarregar e confirmar a posição preservada.                                                           | V: testes de ferramentas e integração atual                 | Aprovado  |
| 71  | danificar uma árvore parcialmente e salvar.                                                            | V: testes de ferramentas e integração atual                 | Aprovado  |
| 72  | recarregar e confirmar dano parcial.                                                                   | V: testes de ferramentas e integração atual                 | Aprovado  |
| 73  | destruir recurso com ferramenta e salvar.                                                              | V: testes de ferramentas e integração atual                 | Aprovado  |
| 74  | recarregar e confirmar objeto destruído.                                                               | V: testes de ferramentas e integração atual                 | Aprovado  |
| 75  | alternar entre dois mundos com ferramentas diferentes.                                                 | V: testes de ferramentas e integração atual                 | Aprovado  |
| 76  | confirmar que ferramentas não são compartilhadas entre mundos.                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 77  | carregar um mundo antigo sem ferramentas.                                                              | V: testes de ferramentas e integração atual                 | Aprovado  |
| 78  | confirmar que inventários antigos permanecem válidos.                                                  | V: testes de ferramentas e integração atual                 | Aprovado  |
| 79  | confirmar que drops não reaparecem duplicados.                                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 80  | confirmar que nenhuma ferramenta é criada ou apagada durante migração de salvamento.                   | V: testes de ferramentas e integração atual                 | Aprovado  |
| 81  | movimentação WASD.                                                                                     | V: testes de ferramentas e integração atual                 | Aprovado  |
| 82  | câmera acompanhando o jogador.                                                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 83  | geração procedural funcionando.                                                                        | V: testes de ferramentas e integração atual                 | Aprovado  |
| 84  | seed preservada.                                                                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 85  | embarque na jangada.                                                                                   | V: testes de ferramentas e integração atual                 | Aprovado  |
| 86  | desembarque da jangada.                                                                                | V: testes de ferramentas e integração atual                 | Aprovado  |
| 87  | navegação marítima.                                                                                    | V: testes de ferramentas e integração atual                 | Aprovado  |
| 88  | mapa e minimapa.                                                                                       | B: pixels do mapa/minimapa, abrir/arrastar/zoom             | Aprovado  |
| 89  | coleta de madeira.                                                                                     | V: testes de ferramentas e integração atual                 | Aprovado  |
| 90  | coleta de pedra.                                                                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 91  | coleta de minério.                                                                                     | V: testes de ferramentas e integração atual                 | Aprovado  |
| 92  | inventário de 16 slots.                                                                                | V: testes de ferramentas e integração atual                 | Aprovado  |
| 93  | barra rápida de 9 posições.                                                                            | V: testes de ferramentas e integração atual                 | Aprovado  |
| 94  | pilhas de materiais até 200.                                                                           | V: testes de ferramentas e integração atual                 | Aprovado  |
| 95  | movimentação e divisão de itens.                                                                       | V: testes de ferramentas e integração atual                 | Aprovado  |
| 96  | crafting das cinco receitas anteriores, quando implementadas.                                          | V: testes de ferramentas e integração atual                 | Aprovado  |
| 97  | salvamento de mundos.                                                                                  | V: testes de ferramentas e integração atual                 | Aprovado  |
| 98  | persistência de objetos destruídos.                                                                    | V: testes de ferramentas e integração atual                 | Aprovado  |
| 99  | persistência de drops no chão.                                                                         | V: testes de ferramentas e integração atual                 | Aprovado  |
| 100 | ausência de erros relevantes no console durante os principais fluxos.                                  | B: fixture de erros nos 44 cenários                         | Aprovado  |
