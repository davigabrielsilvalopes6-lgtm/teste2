# ORIGENS — Survival v0.3

Etapa implementada: coleta de recursos, sobre o HTML v0.2 fornecido. O jogo continua sendo um único HTML autônomo, sem bibliotecas, imagens ou servidor obrigatórios. Abra `ORIGENS — Survival v0.3.html` em um navegador desktop moderno.

## Como jogar

Aproxime-se do recurso, a até 80 pixels lógicos dos pés à base. Aponte para ele, inclusive para a copa da árvore, e dê cliques esquerdos separados por pelo menos 350 ms. Cada clique aplica um golpe. Caminhe até o marcador no chão para recolher automaticamente a até 24 pixels. Madeira, Pedra e Minério aparecem no HUD.

| Recurso | Golpes | Drop único |
| --- | ---: | --- |
| Árvore | 3 | 3 madeiras |
| Pedra | 4 | 2 pedras |
| Cristal/minério | 5 | 1 minério |

Valores provisórios de teste. Juncos e conchas permanecem intactos. Água, lava e sólidos no caminho impedem a extração; não há coleta na jangada ou com mapa/menu/modal aberto. Segurar o mouse não gera golpes automáticos.

WASD move; E embarca/desembarca; M abre/fecha mapa; +/- ajusta zoom; F3 alterna debug; Esc fecha o mapa ou salva e volta ao menu. Se a gravação falhar, Esc mantém a sessão aberta e mostra a falha.

## Arquivos e integração

- `ORIGENS — Survival v0.3.html`: implementação completa.
- `ORIGENS — Mundo Procedural v0.2.html`: original preservado, com SHA-256 idêntico ao anexo (`20e5d3613dfe78a8c995794cb59dbb81797c6bb0c56364b878be43a5cb14ad99`).
- `tests/collection.test.cjs`: testes de regras, persistência e regressões em Node, sem dependências.
- `tests/browser.test.cjs`: testes no Chromium real via CDP, sem dependências npm.

`RESOURCE_TYPES` e `COLLECTION_RULES` centralizam parâmetros. `canvasPoint`, `screenToWorld` e `pickResource` usam o retângulo CSS e a transformação do último desenho, procurando apenas candidatos próximos e seguindo a ordem visual das árvores. `primaryAction` é o ponto de integração para futuras armas.

`hitResource`, `resourcePathClear`, `destroyResource` e `createResourceDrop` tratam alcance, obstáculos, dano individual e destruição única. `collectDrops` atualiza os contadores; `drawDrops` e `drawCollectionFeedback` desenham o feedback provisório. O minimapa é atualizado quando um recurso some.

`G.collection` guarda `removed: Set`, `damage: Map` de dano acumulado por índice de tile, `drops: Map` por ID estável e `materials: {wood, stone, ore}`. Só os drops ativos são percorridos por frame; não há varredura do mapa para coletar. Os materiais podem ser migrados para um inventário futuro, ainda sem slots ou limites de pilha nesta versão.

`build`, `gen`, ruído, seeds e `GEN=2` foram preservados byte a byte. Arte provisória, terrenos e distribuição de recursos também foram preservados. A colisão existente ganhou somente um índice opcional a ignorar no teste do caminho até o próprio alvo. Não foi criado sistema de chunks.

## Save v3

Mantém as chaves `origens_idx_v2` e `origens_w_<id>`. O formato grava `v:3`, `gv:2`, `id`, `x`, `y`, `boat`, `exp` e `collection`, sem serializar `w.ob` ou o terreno. A coleção contém arrays de índices removidos, pares `[índice, dano]`, drops e os três contadores. Mundos com a mesma seed continuam independentes pelo ID.

Saves v2 carregam com coleção vazia. Antes da primeira gravação em v3, uma única cópia v2 é preservada em `origens_w_<id>_backup_v2`. Se não houver espaço para esse backup, a atualização é interrompida, o original é mantido e a falha é informada. A exclusão confirmada do mundo remove também seu backup.

Após gerar e validar o mundo original, `restoreCollection` valida cada entrada, aplica remoções e só então permite validar colisão/posição e montar o minimapa explorado. Entradas inválidas são ignoradas individualmente: remoções de objetos não coletáveis, dano incompatível, IDs duplicados, tipos/quantidades incorretos e coordenadas impróprias não são aplicados. `serializeCollection` grava apenas o estado persistente. O intervalo entre golpes e os efeitos visuais não precisam ser salvos.

Autosave a cada 10 segundos, salvamento ao ocultar a aba e Esc foram mantidos. A migração v1 também foi preservada. Saves com gerador antigo `gv:1` continuam sujeitos à regra preexistente de reiniciar posição/exploração, com aviso; a chave v1 original permanece guardada.

Use o mesmo navegador, perfil e origem para reencontrar os saves. Navegadores não garantem compartilhar o armazenamento entre arquivos locais diferentes; `file://` e uma origem HTTP também não compartilham os mesmos saves.

## Validação executada

**29/29 grupos Node/VM passaram.** Cobertura: copa/seleção, vida por tipo, cooldown, alcance, colisão e liberação do tronco, bloqueios por água/lava/sólidos e UI, drops e recolhimento exato dos três materiais, isolamento entre mundos, restaurações repetidas, dados parcialmente corrompidos, compatibilidade v2/v3, migração v1, backup v2, falhas de armazenamento/índice, Esc sem perder sessão, salvamento ao ocultar aba, movimento diagonal e atalhos.

O gerador foi comparado byte a byte ao original. Para cada tamanho 128, 256, 512 e 1024, a seed `TEST-<tamanho>-0` foi gerada duas vezes; todos os mundos foram válidos e reproduziram terreno, objetos, ilhas e água oceânica de forma idêntica.

**11/11 grupos no Chromium 155 real passaram, com zero exceções não tratadas na execução final.** Foram exercitados criação pelo menu, clique na copa com escala CSS, zoom mínimo/máximo e câmera em movimento, cooldown e clique direito, proteção de HUD/minimapa, arrasto do mapa, persistência de dano/drop/contadores após recargas reais da página, mundos de mesma seed independentes, WASD diagonal, F3, revelação do mapa, embarque/desembarque e exclusão com confirmação.

Um mundo 1024×1024 foi criado e iniciado no navegador. Seu save com um nó parcialmente danificado ocupou 174.936 caracteres, incluindo a exploração existente em base64, sem arrays do mapa. A gravação medida nessa execução levou aproximadamente 2 ms; isso é uma observação desta máquina, não uma garantia para outros dispositivos.

Os testes de navegador posicionam o jogador programaticamente em locais reproduzíveis para testar recursos e costa, e usam eventos reais de mouse/teclado para as interações. Não representam uma sessão inteira de exploração manual.

Limitação do ambiente de validação: a política do Chromium gerenciado bloqueou URLs `file://`. Os testes reais rodaram pelo servidor de loopback de teste, usando exatamente o mesmo HTML. A abertura direta do arquivo em navegador local sem essa política não foi validada aqui. Não há falhas conhecidas nos cenários finais testados; não foi feita uma campanha exaustiva de seeds, navegadores ou desempenho com milhares de drops.

## Reexecutar

Na pasta do repositório:

```sh
node tests/collection.test.cjs
```

Para o teste real, use um perfil isolado: o teste limpa o localStorage da origem de teste. Inicie o Chromium com CDP e o servidor em terminais separados; depois rode o teste:

```sh
chromium --headless --no-sandbox --remote-debugging-port=9222 --user-data-dir=/tmp/origens-browser-tests about:blank
python -m http.server 8765 --bind 127.0.0.1 --directory .
ORIGENS_TEST_URL='http://127.0.0.1:8765/ORIGENS%20%E2%80%94%20Survival%20v0.3.html' node tests/browser.test.cjs
```

Esses processos são necessários apenas para esse método de teste, não para distribuir ou jogar o HTML. Nenhum inventário, crafting, sprite definitivo ou outro sistema futuro foi implementado.
