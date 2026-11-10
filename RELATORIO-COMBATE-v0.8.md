# ORIGENS v0.8 — Fundação do combate

## Base auditada e preservação

O documento novo referencia v0.7 e também chama a atualização de v0.8. A versão de trabalho mais recente já era a v0.8 de baús. Essa entrega foi preservada integralmente em `ORIGENS — Survival v0.8.html` e copiada para `origens-v0.8-baus.html`; seus saves continuam migráveis. Não foi criado outro sistema de baús nesta tarefa. O combate é identificado como **v0.8 Combate**, com revisão de pacote 0.8.1, sem implementar v0.9.

A auditoria anterior à edição foi registrada em `/tmp/origens-combat-audit.json`. Sistemas reais reutilizados: `G.px/py/cx/cy`, `blocked`, `player`, `draw`, `update`, `frame`, `canvasPoint`, `screenToWorld`, `G.aimPoint`, `activeTool`, `primaryAction`, `ITEM_TYPES`, `CRAFT_RECIPES`, `executeCraft`, `inventoryChanged`, `save`, `saveSnapshot`, `start`, `loadWorld`, `sessionInputActive`. Tiles de 32 pixels, caminhada 128px/s, jangada 150px/s, nove atalhos, inventário 16/24/32 e limite 200 para materiais já estavam implementados. A coleta real tem alcance 80 e intervalo 350ms. Os dados anteriores usavam schema 6 e gerador 2.

Não foram modificados gerador, seeds, sprites anteriores, receitas antigas, rendimentos de coleta ou capacidade da mochila. Nenhum framework ou dependência nova foi instalado. Os baús existentes foram mantidos como trabalho anterior, sem adicionar sistemas de construção.

## Atributos, regeneração e estado

Vida, vigor e energia elemental iniciam em 100, com máximo 100 nesta revisão. O HUD mostra números e preenchimento real, com progress de cores vermelha/verde/ciano. A posição é calculada a partir do Canvas para não cobrir nome, materiais, minimapa ou hotbar em janelas com margens.

Vigor regenera 12/s depois de 0,8s; energia, 6/s depois de 1,5s. Vida não regenera. O update usa tempo em segundos, limitado a 250ms por atualização para suspensões; a regeneração foi comparada em 4, 20, 60 e 120 atualizações/s. Menus, mapa, jangada, cursor ocupado e aba oculta suspendem ações e regeneração. Mudança de visibilidade cancela ações transitórias e reinicia a referência de tempo; não se acumulam horas fora do jogo.

O estado pertence ao mundo: idle, moving, attacking, special_attacking, dodging, hit_reaction ou disabled. A lógica é independente da renderização. Ataques e esquiva conflitantes são rejeitados; caminhada normal continua durante básicos. Esquiva e investida usam seu próprio deslocamento e não somam a caminhada no mesmo frame.

## Armas e fabricação

| ID                | Receita existente reutilizada                   | Básico                                             | Especial                                          |
| ----------------- | ----------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `primitive_sword` | 1 cabo simples + 3 pedras lascadas              | 12 dano, arco frontal, alcance 45, cooldown 0,5s   | 24 dano, arco maior, 52 alcance, 20 vigor         |
| `primitive_spear` | 3 gravetos + 1 cabo simples + 2 pedras lascadas | 15 dano, área estreita, alcance 68, cooldown 0,65s | 25 dano, avanço de até 48px, alcance 80, 25 vigor |
| `training_staff`  | 2 cabos simples + 2 pedras lascadas + 1 minério | Projétil de 8 dano, cooldown 0,55s                 | Projétil de 16 dano, 20 energia elemental         |

As três armas são não empilháveis e ficam no inventário normal. A simulação de crafting continua atômica; um lote precisa caber inteiro após o consumo. Existem 13 receitas no total. Uma arma é derivada do slot ativo 0–8; cursor, slot externo e material comum não equipam armas. Guardar arma em baú não a equipa.

Básicos não gastam recursos nesta revisão. O cooldown de especiais é 3s, compartilhado mesmo ao trocar de arma. Um bloqueio básico e tempos por arma também impedem troca rápida para ignorar a recarga. Recursos só são consumidos após validação do início; ação recusada não cobra custo.

## Entradas, acertos e animações

Mouse aponta em coordenadas lógicas, com vetor normalizado, última direção válida e suporte a câmera/zoom. Esquerdo com arma inicia básico; direito inicia especial. Com machado, picareta ou mãos, a coleta continua. O item de baú mantém sua ação anterior. Inventário, crafting, baú, mapa e jangada impedem combate. Digitar em campos não seleciona atalhos.

Cada ataque captura arma, direção e origem no início e possui ID e Set de alvos já atingidos. O efeito ocorre uma vez após 80ms, em update, e a animação dura 240ms. Trocar arma durante o golpe não muda seu dano nem cria um segundo acerto. A renderização conserva o contexto do Canvas, acompanha o corpo atual e não aplica dano, consome atributos, salva ou cria projéteis.

Espada usa arco frontal; lança usa área estreita. A interseção considera o raio do alvo e impede acerto atrás. Segmentos de até 3px verificam obstáculos entre origem e alvo. Alcance é lógico, incluindo o contato com o raio do alvo, não a escala da imagem.

Projéteis usam 220px/s, alcance 180 e vida máxima 2s. A idade de nascimento é considerada para que o primeiro frame não acrescente distância indevida. Subpassos de até 3px verificam rochas, árvores, minérios, baús e limites; projétil em origem bloqueada é rejeitado. Acerto consome o projétil uma vez. Dados inválidos são descartados. O limite é 32 projéteis, com feedback limitado a 64 números temporários.

## Esquiva, dano e derrota

Espaço, centralizado em `COMBAT_RULES.dodgeKey`, executa deslocamento de até 48px em 180ms, custa 20 vigor e tem cooldown 1s. Usa WASD quando há movimento e a mira válida como alternativa. Movimento em passos de até 3px respeita colisões, água e bordas. Não há esquivas específicas das quatro origens ou imunidade de esquiva adicional.

`applyPlayerDamage` rejeita números inválidos, reduz apenas vida, produz reação e marca persistência. A proteção de 0,5s é por origem de dano, com tabela limitada; fontes diferentes não concedem invulnerabilidade global. Chegar a zero cancela ataques/projéteis, bloqueia ações ofensivas e exibe derrota segura. Nada é removido de inventário, mochila, baú ou mundo.

A recuperação fica em modo de treinamento explicitamente ativado pelo menu. Um mundo com vida zero ainda pode abrir menus e o modo de recuperação. Não foi implementado morte definitiva, perda de itens ou respawn normal.

## Treinamento de desenvolvimento

O menu abre o modo por `#treino=1`; `?treino=1` também é aceito nos testes locais. Isso preserva a URL de HTMLPreview. Use um mundo de teste: os botões modificam os atributos daquele mundo, de forma explícita.

São criados até três bonecos próximos em locais transitáveis, sem alterar arrays procedurais ou seed. Eles são estáticos, possuem 100 de vida, colisão, barra, reação e números de dano; não perseguem, não atacam e não produzem loot. Os botões repõem alvos, simulam dano e derrota e recuperam atributos. Não há concessão gratuita de armas no jogo normal ou no início do treino; as receitas são usadas normalmente.

A interface comum `applyTargetDamage` permite reaproveitar a resolução em entidades futuras. Não foram implementados IA, defesa complexa, resistências, drops de monstros ou spawning natural.

## Persistência e compatibilidade

O schema é `v:7`, gerador `gv:2`. Vida, vigor, energia e tempos restantes de cooldown são gravados junto de inventário, mundo e baús no mesmo registro. Ataques, alvos, números, animações e projéteis não são serializados. O carregamento não dispara ataques antigos. Armas e seleção usam o inventário anterior.

Saves v2–v6 continuam reconhecidos. Inicializam atributos válidos, conservam itens, mochila, exploração, seed, posição, jangada e sobreposição de recursos conforme o gerador compatível. O primeiro save atual mantém backup v6 (e os backups anteriores já existentes). Um mundo não compartilha atributos com outro.

Vida negativa/acima do máximo, valores não finitos, cooldown inválido ou dados incompletos não são aceitos. A recuperação em memória preserva o save original contra sobrescrita quando não é segura. Falha real de armazenamento mantém o estado anterior completo e sinaliza alterações não salvas.

A migração é para a versão nova. O HTML antigo de baús não entende schema 7; use o jogo atual para continuar um mundo já atualizado. Saves pertencem à origem do navegador; trocar domínio não transfere dados automaticamente. O comportamento histórico de gerador antigo permanece com aviso, sem recriar esse gerador.

## Arquivos e funções

Criados: `ORIGENS — Survival v0.8 Combate.html`, `origens-v0.8-baus.html`, `origens-v0.8-combate.zip`, `RELATORIO-COMBATE-v0.8.md`, `relatorio-combate-v0.8.md`, `tests/combat.test.cjs`, `tests/e2e/combat.spec.js`, `tests/e2e/combat-navigation.js` e evidências em `evidencias-combate-v0.8/`.

Atualizados: `origens-v0.8.html` (distribuição atual, com backup acima), `README.md`, `package.json`, `package-lock.json`, `scripts/serve.cjs`, `eslint.config.mjs`, `.prettierignore`, `tests/e2e/fixtures.js`, `tests/e2e/origens.spec.js`, `tests/e2e/inventory.spec.js`, `tests/e2e/crafting.spec.js`, `tests/e2e/storage.spec.js`, `tests/e2e/navigation.js` (somente precisão do percurso automatizado). O lockfile só muda a revisão do pacote; dependências continuam iguais.

Principais funções novas: `createCombat`, `validCombatSave`, `serializeCombat`, `activeWeapon`, `combatDirection`, `combatInputAllowed`, `beginCombatAttack`, `beginCombatDodge`, `resolveMelee`, `applyTargetDamage`, `applyPlayerDamage`, `combatObstacle`, `combatSegmentClear`, `combatProjectileStep`, `combatMove`, `updateCombat`, `resetTrainingTargets`, `recoverTrainingPlayer`, `renderCombatHUD`, `drawHeldWeapon`, `drawCombatTarget`, `drawCombatWorld`, `initCombatUI`.

Funções anteriores alteradas somente na nova entrada: `start`, `saveSnapshot`, `loadWorld`, `menu`, `blocked`, `update`, `frame`, `player`, `draw`, `primaryAction`, listeners de teclado/mouse/visibilidade e apresentação das categorias. O gerador e a arte de terreno/objetos anteriores foram preservados.

## Resultados realmente executados

Ambiente: Node 24.22.1, npm 11.9.0, Playwright Test 1.65.0 e Chromium 155.0.8059.79 em Linux. Chromium foi iniciado de fato via HTTP local, com dois workers e sem retries.

| Comando/suíte                          | Resultado executado                                             |
| -------------------------------------- | --------------------------------------------------------------- |
| Coleta/geração, referência v0.3        | 29 grupos aprovados; geração determinística em 128/256/512/1024 |
| Inventário, referência v0.4            | 42 grupos aprovados                                             |
| Crafting, referência v0.5              | 42 grupos aprovados                                             |
| Ferramentas/mochilas, referência v0.7  | 45 + 23 grupos aprovados                                        |
| Armazenamento, referência v0.8 de baús | 42 grupos aprovados                                             |
| Combate no script atual                | 19 grupos aprovados                                             |
| Total Node de npm test                 | 242 grupos aprovados                                            |
| Chromium de npm test                   | 68 aprovados, 0 falhas, 1 ignorado; 2,1 minutos de navegador    |
| npm run lint                           | 0 erros, 0 avisos                                               |
| npm run format:check                   | Código 1; divergências de estilo em 9 arquivos, preservadas     |

O comando completo `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test` terminou com código 0 na validação final. As primeiras execuções de regressão falharam pelos problemas de expectativa/percurso descritos abaixo; não foram ocultadas.

O Prettier apontou o HTML de combate canônico, sua cópia publicada e sete arquivos existentes: `playwright.config.js`, `RELATORIO-PLAYWRIGHT.md`, `RELATORIO-v0.3.md`, `tests/browser.test.cjs`, `tests/collection.test.cjs`, `tests/e2e/fixtures.js`, `tests/e2e/origens.spec.js`. Os novos testes e documentos foram formatados individualmente; a base não foi reformatada para esconder essa dívida.

Os grupos de versões anteriores são referências históricas, não 223 testes novos de combate. Os 19 grupos atuais usam o HTML de combate real; o Chromium exercita a entrada atual em todos os fluxos de regressão.

A espada foi testada do zero: coleta natural de árvore e rocha por teclas/cliques, receitas intermediárias, fabricação, organização, ataque em alvo, especial e save/reload, sem inserir materiais ou teletransportar. Cajado/lança e bordas usam fixtures de ingredientes/alvos explicitamente identificadas, mantendo crafting, controles, colisões e dano reais.

Os testes em VM usam o script atual e substituem apenas pintura DOM. Os testes de navegador verificam eventos, atributos reais de progress, pixels da arma, screenshots, persistência e erros de console/HTTP/JavaScript. A ausência de exceção não é a única prova de funcionamento.

## Falhas, correções e testes não executados

A primeira execução dos nove casos novos passou. Na ampliação para regressão, houve uma falha na expectativa de um teste de armazenamento: ainda esperava schema 6 e recebeu o schema 7 corretamente. A expectativa foi atualizada, sem retirar a verificação dos conteúdos e da falha real de gravação. Outra execução encontrou ultrapassagem do centro de um tile no percurso automatizado de jangada sob carga. O auxiliar de teste passou a soltar a tecla antes do ponto e alinhar com toques curtos nativos, sem escrever posição ou mudar controles do jogo. O percurso isolado passou em 36,3s após o ajuste. Na autoria do teste Node, uma constante usada fora do contexto VM foi corrigida no próprio teste.

Foram refinados a colocação do HUD em janelas com margens, a preservação da arma do golpe em andamento, a colisão na origem do projétil, a ordem de desenho dos alvos e o descarte de tempo de aba oculta. Essas mudanças ganharam verificações específicas antes da validação final.

A escolha de origem elemental continua ausente e seu teste permanece ignorado. Não foram testados Firefox/WebKit, GPU/dispositivo móvel real, toque, multiplayer ou o host público do preview. O Chromium foi executado de fato via HTTP local, com permissão para processos/loopback; nenhuma validação TLS foi desativada.

O HUD usa máximos fixos provisórios. Não há progressão de atributos. A área de treino é transitória e pode ter menos alvos quando faltam posições livres. A imunidade é por fonte, não uma promessa de balanceamento futuro. Dados corrompidos protegidos não possuem editor/exportador nesta entrega. Fechamento abrupto antes de uma gravação não garante recuperar alterações recentes.

Nenhuma implementação de mobs, chefes, 40 armas, armaduras, fome, alimentos, árvores de habilidades, upgrades, novas origens, construções, automação ou versão 0.9 foi adicionada. Os baús anteriores foram apenas preservados.

## Comandos para repetir

```sh
npm ci
npm run test:e2e:install
npm test
npm run lint
npm run format:check
npm start
```

No ambiente validado:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

Jogo local em `http://127.0.0.1:4173/`; o menu dá acesso ao treinamento. Deixe a porta livre para Playwright. O HTML continua autônomo. Não foi aplicado `npm run format` ao jogo inteiro.

## Evidências

As capturas de espada e HUD foram inspecionadas. A captura de falha preserva a expectativa antiga de schema, não uma falha final. O acesso ao host externo HTMLPreview não foi validado aqui; o HTML publicado é conferido byte a byte separadamente.

- [cajado-lanca.png](evidencias-combate-v0.8/cajado-lanca.png)
- [derrota-teste.png](evidencias-combate-v0.8/derrota-teste.png)
- [eslint.txt](evidencias-combate-v0.8/eslint.txt)
- [espada-treino.png](evidencias-combate-v0.8/espada-treino.png)
- [falha-expectativa-schema.png](evidencias-combate-v0.8/falha-expectativa-schema.png)
- [hud-1280x800.png](evidencias-combate-v0.8/hud-1280x800.png)
- [hud-640x480.png](evidencias-combate-v0.8/hud-640x480.png)
- [percurso-corrigido.txt](evidencias-combate-v0.8/percurso-corrigido.txt)
- [prettier.txt](evidencias-combate-v0.8/prettier.txt)
- [primeira-regressao.txt](evidencias-combate-v0.8/primeira-regressao.txt)
- [regressao-percurso.txt](evidencias-combate-v0.8/regressao-percurso.txt)
- [testes-finais.txt](evidencias-combate-v0.8/testes-finais.txt)

## Matriz das 120 verificações

V = grupos do script atual em VM, com pintura DOM substituída. B = Chromium atual, com eventos e pixels reais. R = regressões anteriores executadas na entrada de combate. As linhas são verificações agrupadas, não 120 casos independentes do runner.

| Nº  | Verificação solicitada                                         | Evidência executada                                              |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| 01  | vida inicia em valor válido.                                   | V: testes de combate atuais                                      |
| 02  | vigor inicia em valor válido.                                  | V: testes de combate atuais                                      |
| 03  | energia elemental inicia em valor válido.                      | V: testes de combate atuais                                      |
| 04  | vida nunca fica negativa.                                      | V: testes de combate atuais                                      |
| 05  | vigor nunca fica negativo.                                     | V: testes de combate atuais                                      |
| 06  | energia elemental nunca fica negativa.                         | V: testes de combate atuais                                      |
| 07  | regeneração de vigor funciona.                                 | V: testes de combate atuais                                      |
| 08  | regeneração elemental funciona.                                | V: testes de combate atuais                                      |
| 09  | regeneração respeita o tempo real.                             | V: testes de combate atuais                                      |
| 10  | nenhuma barra ultrapassa o máximo.                             | V: testes de combate atuais                                      |
| 11  | HUD reflete valores corretos.                                  | B: progress real após custos/dano                                |
| 12  | valores inválidos são rejeitados.                              | V: testes de combate atuais                                      |
| 13  | espada registrada no catálogo.                                 | V: testes de combate atuais                                      |
| 14  | lança registrada no catálogo.                                  | V: testes de combate atuais                                      |
| 15  | cajado registrado no catálogo.                                 | V: testes de combate atuais                                      |
| 16  | armas possuem limite de empilhamento 1.                        | V: testes de combate atuais                                      |
| 17  | espada pode ser fabricada.                                     | V: testes de combate atuais                                      |
| 18  | lança pode ser fabricada.                                      | V: testes de combate atuais                                      |
| 19  | cajado pode ser fabricado.                                     | V: testes de combate atuais                                      |
| 20  | ingredientes são consumidos corretamente.                      | V: testes de combate atuais                                      |
| 21  | fabricação sem espaço é rejeitada.                             | V: testes de combate atuais                                      |
| 22  | armas podem ser movidas entre slots.                           | V: testes de combate atuais                                      |
| 23  | armas fora da hotbar não ficam equipadas.                      | V: testes de combate atuais                                      |
| 24  | arma no cursor não fica equipada.                              | V: testes de combate atuais                                      |
| 25  | espada executa ataque básico.                                  | V: testes de combate atuais                                      |
| 26  | lança executa ataque básico.                                   | V: testes de combate atuais                                      |
| 27  | cajado executa ataque básico.                                  | V: testes de combate atuais                                      |
| 28  | espada respeita alcance.                                       | V: testes de combate atuais                                      |
| 29  | lança respeita alcance.                                        | V: testes de combate atuais                                      |
| 30  | cajado respeita alcance do projétil.                           | V: testes de combate atuais                                      |
| 31  | ataques seguem a direção do mouse.                             | V: testes de combate atuais                                      |
| 32  | câmera não altera direção lógica.                              | V: testes de combate atuais                                      |
| 33  | zoom não altera alcance lógico.                                | V: testes de combate atuais                                      |
| 34  | cooldown impede golpes extras.                                 | V: testes de combate atuais                                      |
| 35  | troca de arma não ignora cooldown.                             | V: testes de combate atuais                                      |
| 36  | cada ataque válido aplica dano conforme a regra.               | V: testes de combate atuais                                      |
| 37  | hitbox não atinge alvos fora de sua área.                      | V: testes de combate atuais                                      |
| 38  | ataque não causa múltiplos acertos indevidos.                  | V: testes de combate atuais                                      |
| 39  | espada executa especial.                                       | V: testes de combate atuais                                      |
| 40  | lança executa especial.                                        | V: testes de combate atuais                                      |
| 41  | cajado executa especial.                                       | V: testes de combate atuais                                      |
| 42  | especial consome recurso correto.                              | V: testes de combate atuais                                      |
| 43  | recurso insuficiente bloqueia especial.                        | V: testes de combate atuais                                      |
| 44  | especial rejeitado não consome recurso.                        | V: testes de combate atuais                                      |
| 45  | cooldown de especial funciona.                                 | V: testes de combate atuais                                      |
| 46  | troca de arma não permite exploração de cooldown.              | V: testes de combate atuais                                      |
| 47  | especial não atravessa obstáculos indevidamente.               | V: testes de combate atuais                                      |
| 48  | especial não executa durante menus.                            | V: testes de combate atuais                                      |
| 49  | esquiva pode ser acionada pela tecla provisória.               | V: testes de combate atuais                                      |
| 50  | esquiva consome vigor.                                         | V: testes de combate atuais                                      |
| 51  | vigor insuficiente impede esquiva.                             | V: testes de combate atuais                                      |
| 52  | cooldown impede repetição imediata.                            | V: testes de combate atuais                                      |
| 53  | esquiva respeita colisões.                                     | V: testes de combate atuais                                      |
| 54  | esquiva não atravessa água.                                    | V: testes de combate atuais                                      |
| 55  | esquiva não atravessa limites.                                 | V: testes de combate atuais                                      |
| 56  | esquiva não é ativada durante jangada.                         | V: testes de combate atuais                                      |
| 57  | esquiva não é ativada durante menus.                           | V: testes de combate atuais                                      |
| 58  | esquiva termina sem prender o personagem.                      | V: testes de combate atuais                                      |
| 59  | projétil nasce em posição válida.                              | V: testes de combate atuais                                      |
| 60  | projétil segue direção do mouse.                               | V: testes de combate atuais                                      |
| 61  | projétil possui velocidade consistente.                        | V: testes de combate atuais                                      |
| 62  | projétil desaparece após alcance máximo.                       | V: testes de combate atuais                                      |
| 63  | projétil desaparece após colisão relevante.                    | V: testes de combate atuais                                      |
| 64  | projétil não atravessa obstáculos sólidos.                     | V: testes de combate atuais                                      |
| 65  | projétil não atinge o mesmo alvo repetidamente por erro.       | V: testes de combate atuais                                      |
| 66  | projéteis temporários não são restaurados após recarregar.     | V: testes de combate atuais                                      |
| 67  | múltiplos projéteis não travam o loop principal.               | V: testes de combate atuais                                      |
| 68  | projéteis inválidos são descartados com segurança.             | V: testes de combate atuais                                      |
| 69  | alvo de treinamento possui vida válida.                        | V: testes de combate atuais                                      |
| 70  | espada causa dano ao alvo.                                     | V: testes de combate atuais                                      |
| 71  | lança causa dano ao alvo.                                      | V: testes de combate atuais                                      |
| 72  | cajado causa dano ao alvo.                                     | V: testes de combate atuais                                      |
| 73  | ataque fora do alcance não causa dano.                         | V: testes de combate atuais                                      |
| 74  | alvo não recebe golpes duplicados.                             | V: testes de combate atuais                                      |
| 75  | feedback visual representa o dano aplicado.                    | V: testes de combate atuais                                      |
| 76  | vida do alvo não fica negativa.                                | V: testes de combate atuais                                      |
| 77  | alvo derrotado deixa de receber golpes inválidos.              | V: testes de combate atuais                                      |
| 78  | alvo de treinamento não produz loot.                           | V: testes de combate atuais                                      |
| 79  | jogador pode receber dano simulado.                            | V: testes de combate atuais                                      |
| 80  | HUD atualiza após dano.                                        | B: progress real após custos/dano                                |
| 81  | invulnerabilidade temporária impede dano repetido indevido.    | V: testes de combate atuais                                      |
| 82  | vida zero interrompe ações ofensivas.                          | V: testes de combate atuais                                      |
| 83  | vida zero não apaga inventário.                                | V: testes de combate atuais                                      |
| 84  | recuperação de teste não duplica itens.                        | V: testes de combate atuais                                      |
| 85  | dano recebido não altera energia sem regra explícita.          | V: testes de combate atuais                                      |
| 86  | dano recebido não altera vigor sem regra explícita.            | V: testes de combate atuais                                      |
| 87  | vida é salva.                                                  | V: testes de combate atuais                                      |
| 88  | vigor é salvo.                                                 | V: testes de combate atuais                                      |
| 89  | energia elemental é salva.                                     | V: testes de combate atuais                                      |
| 90  | armas permanecem no inventário.                                | V: testes de combate atuais                                      |
| 91  | seleção da hotbar é restaurada.                                | V: testes de combate atuais                                      |
| 92  | mundos diferentes possuem atributos independentes.             | V: testes de combate atuais                                      |
| 93  | mundo antigo da v0.7 continua carregando.                      | V: testes de combate atuais                                      |
| 94  | ferramentas antigas são preservadas.                           | V: testes de combate atuais; B/R: migração real de saves antigos |
| 95  | mochilas antigas são preservadas.                              | V: testes de combate atuais; B/R: migração real de saves antigos |
| 96  | itens antigos são preservados.                                 | V: testes de combate atuais; B/R: migração real de saves antigos |
| 97  | estados transitórios de ataque não causam ações ao recarregar. | V: testes de combate atuais                                      |
| 98  | salvamento inválido não sobrescreve dados íntegros.            | V: testes de combate atuais                                      |
| 99  | movimentação WASD.                                             | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 100 | câmera.                                                        | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 101 | zoom.                                                          | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 102 | jangada.                                                       | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 103 | mapa.                                                          | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 104 | minimapa.                                                      | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 105 | geração procedural.                                            | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 106 | coleta de madeira.                                             | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 107 | coleta de pedra.                                               | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 108 | coleta de minério.                                             | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 109 | machado.                                                       | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 110 | picareta.                                                      | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 111 | crafting básico.                                               | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 112 | crafting de ferramentas.                                       | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 113 | mochilas.                                                      | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 114 | inventário inicial de 16 slots.                                | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 115 | hotbar de nove posições.                                       | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 116 | limite de pilhas de materiais.                                 | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 117 | persistência de drops.                                         | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 118 | persistência de recursos destruídos.                           | R: coleta, ferramentas, mochila, mapa e armazenamento            |
| 119 | carregamento de mundos antigos.                                | V: testes de combate atuais; B/R: migração real de saves antigos |
| 120 | ausência de erros relevantes no console.                       | B: fixture monitora console/JavaScript/HTTP nos 68 casos         |
