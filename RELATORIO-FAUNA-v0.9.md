# ORIGENS — Relatório de implementação v0.9 (versão de revisão)

## Escopo

A branch `feature/origens-v0.9-fauna-elemental` adiciona o arquivo `ORIGENS — Survival v0.9 Fauna Elemental.html`, mantendo o HTML da 0.8.1 intacto. O novo documento carrega `assets/mobs/mobs-v09.js`, uma extensão de IA integrada ao ciclo de jogo e aos alvos de combate existentes.

### Criaturas

| Região | Inimigo | Comportamento | Ataque |
| --- | --- | --- | --- |
| Fogo | Salamandra Ígnea | Patrulha, persegue e tenta manter distância | Bola de fogo e ataque próximo |
| Terra | Javali Rochoso | Persegue, avisa e investe com trajetória definida | Investida e contato próximo |
| Ar | Espírito do Vento | Movimentação lateral e perseguição ágil | Projétil com empurrão |
| Água | Serpente dos Rios | Circula em terreno aquático/úmido e na margem | Jato de água e ataque próximo |

A IA utiliza os estados `wander`, `chase`, `prepare`, `attack`, `recover` e `return`. Existe limite de criaturas ativas, cooldown, controle de projéteis, tentativa de posicionamento em terreno válido e proteção da ilha inicial.

### Integração existente

- Combate: os inimigos aproveitam as mesmas estruturas de alvos e danos presentes no sistema 0.8.1.
- Jogador: ataques dos mobs usam a função já existente de receber dano.
- Salvamento: nenhuma alteração foi feita no esquema `v:8`; mobs são entidades temporárias que reaparecem e **não persistem individualmente**. Saves anteriores não são sobrescritos por nova migração.
- Inventário, baús, crafting, equipamentos e avatar não foram reescritos.
- A 0.10 continua responsável por drops funcionais e caça.

### Limitação importante: sprites

O repositório consultado contém estudos/referências de salamandra, e **não** dispõe das sprite sheets finais validadas dos quatro inimigos. Por isso os monstros são apresentados com **pixel art provisória produzida em Canvas**, devidamente separada da arte definitiva.

O carregador **não solicita sprites inexistentes** para evitar erros HTTP. Para habilitar assets futuros, adicionar a lista verificada em `window.ORIGENS_MOB_SHEET_PATHS` antes de carregar `mobs-v09.js`, com caminhos relativos à pasta `assets/mobs/`. Cada imagem precisa ter dimensões, transparência, ordem de direções e animação auditadas. A atualização atual não afirma fornecer sprites finais.

### Testes e estado

- A sintaxe de `mobs-v09.js` foi validada com mecanismo JavaScript.
- Uma simulação isolada em JavaScript verificou criação e aparecimento de Salamandra, Javali, Espírito e Serpente em regiões adequadas.
- Adicionado `tests/mobs-v09.test.cjs` ao conjunto de testes unitários.
- **Não foram executados os testes reais de navegador, npm/Playwright, colisão visual e salvamento em sessão de navegador.** A conexão com GitHub usada aqui não oferece um navegador local do repositório, e o ambiente de arquivos não conseguiu clonar o repositório. Portanto a branch é uma versão de revisão, sem certificação de QA.
- É necessário rodar `npm ci && npm run test:unit && npm run test:e2e` num ambiente com Node e Chromium compatíveis.
- Verificar pessoalmente os inimigos em cada ilha, desempenho, colisões, ataques, morte e retorno ao menu antes de mesclar.

### Uso

```sh
npm ci
npm start
```

Abrir `http://127.0.0.1:4173/` para testar o HTML 0.9. O original 0.8.1 permanece disponível pelo seu nome de arquivo.

### Próximos passos

1. Rodar os testes de navegador e corrigir falhas.
2. Auditar e substituir os desenhos temporários pelos sprites finais.
3. Balancear vida, dano, alcance, frequência de spawn e animações com gameplay real.
4. Implementar drops e progressão da caça **somente na 0.10**.
