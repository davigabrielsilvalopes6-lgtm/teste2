# ORIGENS 0.9.1 — Integração das quatro criaturas aprovadas

## Entrega

Foram adicionadas **26 sprite sheets PNG** extraídas do ZIP `ORIGENS_4_criaturas_aprovadas (1).zip`, fornecido pelo usuário, nas pastas:

- `assets/mobs/fire_salamander/` — 7 PNGs;
- `assets/mobs/rock_boar/` — 7 PNGs;
- `assets/mobs/wind_spirit/` — 6 PNGs;
- `assets/mobs/river_serpent/` — 6 PNGs.

A 0.9.1 liga `idle`, `walk`, `attack`, `hurt` e `death` às máquinas de estados dos inimigos. Os arquivos originais de ataque secundário da salamandra e do javali também foram mantidos como folhas separadas. Foram conectados projéteis de fogo, água e vento e poeira de investida. Todas as quatro direções são carregadas por linha da folha (baixo, cima, esquerda, direita).

O carregador valida dimensões reais das PNGs, deixa a suavização de Canvas desligada e só recorre ao desenho provisório em falha de carregamento. Nenhuma mecânica de drop foi ativada.

## Limitações dos arquivos de entrada

As imagens originais fornecidas não eram PNGs transparentes de produção: eram grandes pranchas compostas, com texto e grade. Os PNGs publicados aqui são reconstruções a partir dos recortes dessas pranchas, com remoção automática de fundo e quantização de cores. **Ainda podem existir resíduos discretos de grade, bordas ou diferenças de alinhamento que precisam de revisão artística**. Não foram redesenhadas animações ausentes. A serpente e o espírito só usam as animações presentes nas pranchas aprovadas.

## Compatibilidade

- O HTML da versão 0.8.1 permanece inalterado.
- O HTML 0.9 foi atualizado apenas para usar o novo carregador e indicar revisão 0.9.1.
- Saves continuam no esquema existente `v:8`, sem migração.
- Não alteramos inventário, baús, crafting, movimento ou controles do jogador.
- A 0.10 continua reservada para drops/loot.

## Verificação

- Verificadas dimensões dos PNGs no ambiente de extração e integridade dos arquivos preparados.
- Adicionado teste Playwright `tests/e2e/mobs-v091.spec.js`, que decodifica as 26 sprites e verifica tamanho de frame/linhas.
- A execução dos testes completos no navegador continua pendente até rodar a pipeline de CI ou um navegador local contra o jogo completo.
- As sprites possuem recortes automatizados, não aprovação quadro a quadro. Inspecionar o resultado antes de considerar as animações definitivas.

## Como testar

```sh
npm ci
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm start
```

No GitHub Pages, abrir o endereço do repositório. O arquivo `index.html` redireciona para o HTML da versão 0.9, que agora carrega a revisão 0.9.1 da fauna.
