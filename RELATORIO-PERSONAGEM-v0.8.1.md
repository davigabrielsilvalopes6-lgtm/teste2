# ORIGENS — personagem oficial v0.8.1

Data: 10/11/2026. Base preservada: commit `2aa9bac1f22c7ac107b38831dde5b45c846f378b`, arquivo `ORIGENS — Survival v0.8 Combate.html`. Esta atualização integra a arte recebida; não é a versão 0.9.

## 1. Arquivos recebidos

ZIP `ORIGENS_personagem_4_lados_animacao.zip`: `personagem_normal.png`, `personagem_4_lados.png`, `personagem_animacao_caminhada.png` e `LEIA_ME.txt`. Os arquivos foram preservados em `assets/characters/player/source/`, sem alteração dos bytes. O texto de acompanhamento informa que são referências visuais, não folhas técnicas validadas em 48 × 64. A especificação de implementação foi o texto fornecido pelo usuário antes do ZIP.

## 2. Dimensões e auditoria real

| Imagem recebida                     | Dimensões   | Formato e transparência                     | Organização constatada                                                                |
| ----------------------------------- | ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `personagem_normal.png`             | 1536 × 1024 | PNG RGB, sem alfa; fundo escuro incorporado | Uma referência estática; mantida como referência.                                     |
| `personagem_4_lados.png`            | 1254 × 1254 | PNG RGBA, com transparência e alfa parcial  | Frente/costas/esquerda/direita em disposição 2 × 2; mantida como referência.          |
| `personagem_animacao_caminhada.png` | 1330 × 1182 | PNG RGBA, com transparência e alfa parcial  | Quatro linhas e seis poses por linha, com espaçamento irregular. Fonte usada no jogo. |

Foi criado um atlas de **1152 × 1088**, com células transparentes de **192 × 272**, seis colunas e quatro linhas. Linhas: down, up, left, right. Âncora única: `(96, 264)`. A escala no Canvas é uniforme: **0,125**, resultando em células de 24 × 34 unidades do mundo, cujos tiles continuam com 32 unidades.

O script faz recorte e padding, copiando RGBA literalmente. Não recolore, não cria detalhes, não redimensiona os arquivos originais, não separa roupas por estimativa e não espelha vistas. Os limites do personagem principal foram identificados em cada célula; o padding alinha o centro e os pés. As poses recebidas têm pequenas diferenças próprias de silhueta e altura, preservadas.

Hash SHA-256 da imagem de caminhada recebida: `9c7253cfffc6da5ee79e4629acce14d8fbe4d2ec6429dde6b8d1dcee5f1b8ddd`.

Hash SHA-256 do HTML v0.8 preservado: `2b0148437dbe9354dd2e13a021cf97f9626dc896eac83436d9bdd45340749d52`.

## 3. Animações disponíveis

- Caminhada: **24 poses fornecidas**, seis para cada uma das quatro direções.
- Parado: uma pose por direção, usando o primeiro frame da respectiva linha de caminhada. É uma representação estática de idle, sem alegar um ciclo de animação inexistente.

## 4. Animações e camadas ausentes

Não vieram ciclos próprios de idle, ataque, ataque especial, esquiva ou reação a dano. Também não vieram corpo-base neutro, cabelo, camisa, calça, botas, luvas, capacete, armadura ou acessórios separados, nem alternativas de roupas. As três imagens mostram o personagem com o visual completo incorporado.

Esses recursos não foram inventados. A integração de caminhada está disponível; **personalização independente de peças depende de novos assets**. Os efeitos de combate anteriores continuam sendo usados com uma pose do personagem oficial.

## 5. Arquivos criados e modificados

Criados:

- `ORIGENS — Survival v0.8.1.html`: novo jogo autônomo.
- `origens-v0.8.1.html`: cópia idêntica destinada à publicação no navegador.
- `assets/characters/player/source/`: os quatro arquivos originais do ZIP.
- `assets/characters/player/player-walk-atlas.png`, `player_animations.json` e `README.md`.
- `scripts/prepare-player-assets.py`: preparação técnica dos recortes.
- `tests/appearance.test.cjs`: validação de aparência, controlador, cache, desenho e preservação dos sistemas existentes.
- `tests/verify-player-assets.py`: comparação independente dos pixels de origem e atlas.
- `tests/e2e/appearance.spec.js`: testes reais de Canvas, movimento, painel, persistência, migração e falha de asset.
- `RELATORIO-PERSONAGEM-v0.8.1.md` e `evidencias-personagem-v0.8.1/`.

Modificados:

- `scripts/serve.cjs`: entrada atual v0.8.1; mantém acesso à v0.8 Combate preservada.
- `package.json`: acrescenta o teste de aparência ao comando unitário; nenhuma dependência foi adicionada ou removida.
- `eslint.config.mjs`: permite os nomes reais de aparência somente nos callbacks de navegador dos testes.
- `.prettierignore`: preserva a versão anterior e ignora o manifesto gerado.
- `tests/e2e/fixtures.js`: título atual.
- `tests/e2e/origens.spec.js`: pixels do personagem oficial e schema atual.
- `tests/e2e/storage.spec.js`: schema atual.
- `tests/e2e/combat.spec.js`: verificação de energia considera a regeneração durante os eventos reais do mouse.
- `README.md`: entrada, acesso ao painel, assets e limitações.

O HTML de combate anterior e seu arquivo publicado `origens-v0.8.html` permanecem intactos. As versões anteriores também foram preservadas. Não houve reformatação geral do jogo.

## 6. Funções adicionadas

Carregamento: `loadPlayerAsset`, `updatePlayerAssetStatus`.

Aparência: `defaultAppearance`, `validAppearance`, `restoreAppearance`, `serializeAppearance`, `appearanceLayers`, `setAppearancePart`.

Animação e desenho: `createAvatarController`, `avatarDirection`, `updateAvatar`, `avatarFrame`, `drawAppearance`, novo `player`.

Interface: `setAppearanceOpen`, `renderAppearancePreview`, `renderAppearanceUI`, `initAppearanceUI`.

O desenho anterior passou a se chamar `legacyPlayer` e é usado somente como fallback informado quando o recurso oficial está indisponível.

## 7. Funções alteradas e sistemas preservados

`start`, `saveSnapshot` e `loadWorld` passam a reconhecer aparência/schema 8. `menu` fecha o painel e remove também o backup v7 quando o jogador exclui expressamente um mundo. `sessionInputActive`, `worldInputActive` e o roteamento de teclado incluem o novo painel. `update` captura deslocamento real, pausa movimento/câmera durante o painel e atualiza o controlador visual. A inicialização registra a interface e inicia o carregamento uma única vez.

O teste de preservação compara trechos integrais entre v0.8 e v0.8.1: **geração procedural, modelos de inventário, crafting e armazenamento, desenho do mundo e profundidade, coleta e ferramentas (exceto a condição que bloqueia ações com o painel aberto), regras e implementação do combate**. Esses trechos permanecem byte a byte iguais. Não foram alterados dano, alcance, velocidade, custos, cooldowns, colisões, receitas, progressão, número de slots ou gráficos do cenário.

## 8. Como os sprites carregam

O PNG do atlas é incorporado ao HTML em base64, sem rede, pasta externa obrigatória ou framework. O teste Node confere que seus bytes são os mesmos do atlas auditado. `PLAYER_ASSETS` mantém o recurso em cache: chamadas repetidas devolvem o mesmo registro e a mesma imagem. O menu informa o carregamento e aguarda a conclusão antes de habilitar seus botões. As dimensões decodificadas são validadas.

Falha de decodificação ou dimensões incorretas gera mensagem explícita e permite usar o desenho provisório anterior sem sobrescrever a aparência escolhida. Nenhuma imagem é construída por frame. O carregador não refaz downloads a cada desenho.

## 9. Controlador de animação

Um controlador por jogador mantém estado, direção, frame, tempo e indicação de movimento real. Estados: idle, walk, attack, special_attack, dodge e hit_reaction. Caminhada roda a 8 frames por segundo, ciclando somente as seis poses recebidas. As demais ações usam a pose fornecida e os efeitos existentes.

O deslocamento efetivo determina walk; pressionar contra uma colisão não simula caminhada. Parar retorna ao frame 0 e mantém a direção. A regra de direção diagonal é a mesma da movimentação anterior, sem alternância por frame. Virar durante a caminhada mantém o relógio central; ataque e esquiva consultam suas direções reais. O controlador não calcula nem aplica dano e não modifica posições ou atributos.

## 10. Composição e profundidade

Existe catálogo validado para os slots visuais. Hoje somente `outfit.original` aponta para um recurso real: o visual completo recebido. As camadas ausentes permanecem nulas, sem IDs fictícios de cabelo ou camisa.

`drawAppearance` usa o mesmo frame, direção, âncora e escala em todas as entradas válidas do catálogo. Atualmente desenha uma imagem completa. Isso prepara a composição; **não equivale a possuir camadas separadas utilizáveis**. A ordem futura de camadas independentes deve ser validada quando tais arquivos existirem.

O desenho fica na mesma etapa de profundidade do personagem, dentro do desenho do mundo anterior. Não há uma etapa global de roupas por cima do cenário. Armas e ferramentas podem ficar atrás quando apontadas para cima e à frente nas outras direções. No caminho normal, o personagem antigo não é desenhado junto com o novo. Todos os contextos novos usam `imageSmoothingEnabled = false`, destino alinhado em coordenadas inteiras e escala uniforme.

## 11. Customização disponível

Acesso: **I → PERSONAGEM**. O painel mostra a prévia real nas quatro direções. Cabelo, camisa, calça e botas informam que a camada separada não foi fornecida e permanecem desabilitados. O único visual disponível é o original completo.

`setAppearancePart` aceita apenas recursos registrados, com alterações cosméticas desacopladas de inventário e atributos. Não há alternativa real para demonstrar uma troca nesta entrega. O painel não concede itens, não cria outro inventário e não altera estatísticas.

O painel bloqueia WASD, coleta, ataques, esquiva, jangada, abertura de baú e mapa. Cliques nos seus controles não chegam ao Canvas. Fechar retorna ao inventário; I/Esc também fecham, e C permite ir ao crafting sem sobrepor os painéis. O cursor com pilha impede a abertura até que os itens sejam guardados. Hotbar com nove slots e inventários de 16/24/32 permanecem funcionando.

## 12. Sincronização das roupas

No material atual, roupas e corpo estão na mesma imagem e por isso seguem exatamente a mesma pose. A infraestrutura de composição consulta um único controlador e não cria relógios por peça. A sincronização entre arquivos independentes ainda não pode ser validada: esses arquivos não existem no ZIP.

## 13. Armas, ferramentas e combate

As representações existentes de machado, picareta, espada, lança e cajado foram preservadas. Não houve redesenho desses equipamentos. A seleção continua vindo do slot da hotbar; arma/ferramenta não se torna uma roupa nem interfere na aparência persistida.

Ataque básico/especial, projétil, esquiva, custos, cooldowns, vida, vigor, energia e alvos de treinamento continuam na implementação anterior. A direção visual da esquiva acompanha seu vetor. Sem frames específicos, o personagem mantém sua arte oficial enquanto os efeitos existentes representam a ação.

## 14. Persistência da aparência

O save por mundo agora tem `v: 8`, mantendo `gv: 2` e acrescentando `appearance`, versão 1. Inventário, armazenamento, coleta, posição, exploração e combate continuam na mesma gravação atômica. O único visual disponível é identificado por `outfit: 'original'`; os slots sem assets ficam nulos.

Cada carregamento cria um objeto independente por mundo. Aparências inválidas ou de uma versão futura impedem sobrescrever o save original; a sessão informa recuperação parcial e usa uma representação segura em memória. Uma falha do carregador não modifica a escolha persistida.

## 15. Compatibilidade com saves anteriores

São aceitos schemas 2 a 8. Os anteriores à aparência recebem a configuração inicial válida sem itens grátis ou reset. Ao gravar pela primeira vez sobre um save anterior, é guardada uma cópia exata em `origens_w_<id>_backup_v<versão>`. Se não houver espaço para preservar o backup, a gravação falha explicitamente e o anterior permanece intacto. Não são criados backups repetidos para a mesma versão.

O teste de migração cria um save usando o HTML v0.8 Combate real, adiciona uma fixture declarada com as três armas, machado, picareta e madeira, aplica dano e carrega o mesmo mundo na versão nova. Compara todos os campos anteriores após salvar, além de conferir o backup literal. Os testes existentes também exercitam migração de versões anteriores com ferramentas, mochilas e baús.

## 16. Comandos executados e reprodução

Ambiente: Node.js 24.22.1, npm 11.9.0, Playwright Test 1.65.0 e Chromium do sistema `/usr/bin/chromium`. Nenhum pacote novo de execução ou framework foi instalado. Pillow, NumPy e SciPy já estavam disponíveis para o recorte técnico; não são dependências do navegador.

```sh
python scripts/prepare-player-assets.py
python tests/verify-player-assets.py
node tests/appearance.test.cjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run lint
npm run format:check
```

`npm test` executou os testes Node e a suíte do navegador. Durante o desenvolvimento houve falhas de expectativa dos testes, descritas abaixo; a execução final do navegador foi repetida após corrigi-las. Para uma máquina nova: `npm ci`, `npm run test:e2e:install` e `npm test`. `npm start` abre o servidor local em `http://127.0.0.1:4173`; o Playwright sobe seu próprio servidor, portanto não mantenha outro na mesma porta.

## 17. Resultados aprovados

| Verificação                                      | Resultado real                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Testes Node de regressão das versões preservadas | 242 grupos aprovados.                                                                          |
| Testes Node da integração v0.8.1                 | 16 grupos aprovados.                                                                           |
| Playwright / Chromium, execução final completa   | **77 aprovados, 0 reprovados e 4 ignorados, em 2,4 minutos (81 cenários).**                    |
| Comparação independente do atlas                 | 24 recortes idênticos em RGBA, distintos, dentro dos limites e com âncora dos pés consistente. |
| Originais versus ZIP recebido                    | Os quatro arquivos são idênticos byte a byte.                                                  |
| ESLint                                           | Aprovado: 0 erros e 0 avisos.                                                                  |
| Prettier geral                                   | Reprovado por estilo em 9 arquivos; nenhuma reformatação geral foi aplicada.                   |
| HTML de publicação versus entrada                | Cópias idênticas.                                                                              |

Resultados reproduzíveis em [evidencias-personagem-v0.8.1](evidencias-personagem-v0.8.1/), incluindo logs Node, execução final do Playwright, ESLint e Prettier. Capturas: [personagem no mundo](evidencias-personagem-v0.8.1/personagem-zoom-maximo.png), [painel Personagem](evidencias-personagem-v0.8.1/painel-personagem.png), [painel no celular simulado](evidencias-personagem-v0.8.1/painel-personagem-mobile.png), [espada em treinamento](evidencias-personagem-v0.8.1/espada-personagem.png) e [cajado/lança](evidencias-personagem-v0.8.1/cajado-lanca-personagem.png).

Os novos testes verificam pixels da arte recebida no **Canvas visível**, com a composição alfa correta sobre o terreno, em zooms 0,75 / 1 / 1,25 / 1,5. Não basta existir um elemento Canvas ou não haver exceção. A comparação de recortes confere todos os bytes RGBA dos 24 frames com os arquivos recebidos; o teste de cache verifica uma única imagem; o controlador percorre todos os seis frames.

Movimento real via teclado, quatro direções, diagonal estável, retorno ao idle estático, quatro prévias distintas, bloqueio de ações, painel em 1280 × 800 / 640 × 480 / 390 × 844, saves por mundo, migração v0.8 e proteção de aparência desconhecida são exercitados. Uma resposta HTTP de teste substitui apenas a imagem incorporada por um PNG válido de dimensões incorretas para verificar o fallback real no navegador; o teste Node também exercita `onerror` e preservação da aparência.

A regressão existente cobre combate, coleta natural de madeira/pedra/minério, crafting, ferramentas, mochila, nove atalhos, capacidades 16/24/32, baús e cursor compartilhado, drops, recursos destruídos persistentes, saves, jangada, mapa, minimap, zoom e HUD. As fixtures observam erros JavaScript, console, requisições e respostas HTTP inesperadas.

## 18. Falhas encontradas nas execuções intermediárias

- A primeira comparação visual exigia pixels com alfa exatamente 255. As referências têm alfa parcial e, em zoom 1, os pontos amostrados não incluíam pixels completamente opacos. O personagem estava presente; a verificação foi corrigida para comparar mais de 100 pixels com alfa ≥ 250, com margem máxima de 6 níveis de cor pela contribuição do terreno e arredondamento. A preparação não alterou o alfa original.
- A fixture inicial de migração usava nomes hipotéticos de ferramentas. Foram corrigidos para os IDs constatados no catálogo: `stone_axe` e `stone_pickaxe`. A comparação agora inclui os seis slots ocupados reais.
- Um teste antigo de energia esgotada esperava valor < 1 após eventos do mouse, mas a energia chegou a 1,0998 pela regeneração normal de 6/s. O teste passou a comparar a energia com o tempo de combate decorrido e a exigir serial, cooldown e vida do alvo inalterados. Nenhuma regra de regeneração foi alterada. Screenshot e contexto da falha foram preservados em `evidencias-personagem-v0.8.1/teste-temporal-energia-falhou.*`.
- A primeira versão da auditoria de preservação incluía também a função de bloqueio de entrada, que precisava reconhecer o novo painel. A comparação foi delimitada para manter a checagem literal das mecânicas e separar essa alteração intencional.

Essas falhas não foram ocultadas com retries, tolerância de dano ou remoção de cenários. O Playwright continua com zero retries.

## 19. Não executados e limites da cobertura

Três cenários são explicitamente ignorados por falta de recursos: troca independente de camisa/calça/botas; composição com corpo-base neutro/cabelo separados; ciclos dedicados de idle/combate. A escolha de origem elemental continua ignorada na regressão anterior porque não está implementada no jogo atual.

Nos critérios numerados da especificação, **29, 34–36 e a validação de camadas independentes em 26/37–39 não são declarados aprovados**. Os elementos visuais 30–33 aparecem na arte completa, sem comprovação de arquivos separados. Os itens 13–16 funcionam como poses estáticas; um ciclo dedicado não foi validado. Há persistência por mundo com o visual original, mas não é possível testar escolhas diferentes de roupas entre mundos sem alternativas reais. A falha de uma peça separada não foi testada com arquivo real de roupa: foi testado o recurso completo e o validador de IDs.

Profundidade preservada estruturalmente e conferida nas screenshots; não há cobertura visual exaustiva de toda árvore, objeto, ângulo de ataque e pose. Não houve teste manual em celulares físicos nem medição formal de FPS. Não foram criados frames de combate, sprites novos ou alternativas recoloridas para contornar a ausência dos assets.

## 20. Ajustes e correções desta integração

Recortes sem grade presumida, padding e âncora única evitam deslocamento introduzido pela folha irregular. A direção da esquiva foi ligada ao vetor da ação. O jogador anterior só participa do fallback informado; cache e validação evitam imagens novas por frame ou personagem invisível por dimensões inválidas. O painel foi incluído nos bloqueios de entrada/movimento/câmera e não redesenha sua prévia a cada frame sem necessidade.

Não foram corrigidos ou balanceados bugs de jogabilidade como parte desta tarefa. Os ajustes nos testes tratam expectativas de transparência, identificação dos itens reais e passagem normal do tempo.

## 21. Limitações restantes e entrega

O personagem fornecido já pode ser usado no mundo com caminhada nas quatro direções, poses paradas e combate/ferramentas existentes. Para concluir personalização por peça, são necessários corpo-base e camadas registradas com o mesmo grid, âncora, direções e frames, além das alternativas desejadas. Para animações próprias de idle/ataque/especial/esquiva/dano, faltam os respectivos frames.

O HTML é autônomo e seu PNG não depende de um servidor de assets. A v0.8 permanece intacta. Os testes foram executados no Chromium real do ambiente; isso não certifica todos os navegadores. A prévia externa HTMLPreview não pôde ser validada nesta nuvem devido à política de rede; os bytes publicados no GitHub foram conferidos separadamente por download HTTPS e comparação com o HTML testado. Saves do navegador dependem da mesma origem e das permissões de armazenamento do navegador.

A formatação geral do jogo foi preservada: `format:check` ainda aponta os dois HTMLs atuais e sete arquivos com dívida de formatação anterior. Isso é uma verificação reprovada de estilo, não um resultado aprovado nem uma falha de jogabilidade.

Publicação confirmada em `main`, commit do jogo `d9252b433fce3148cb3123df5e2317034815c9a7`. O HTML obtido de `raw.githubusercontent.com` é idêntico ao arquivo validado; SHA-256 de ambos: `3668cdab3fb32d111d789e2b9e6b9596fb0f6176550898a95b60651a5d284259`. [Link para jogar no navegador](https://htmlpreview.github.io/?https://github.com/davigabrielsilvalopes6-lgtm/teste2/blob/d9252b433fce3148cb3123df5e2317034815c9a7/origens-v0.8.1.html). A publicação do arquivo foi confirmada; a disponibilidade do visualizador externo permanece não verificada nesta nuvem.
