# Configuração Playwright — ORIGENS

## Inspeção real

Antes desta tarefa, o repositório continha os HTMLs v0.2/v0.3, o relatório v0.3 e os testes `tests/collection.test.cjs` (Node/VM) e `tests/browser.test.cjs` (Chromium via CDP). Não havia `package.json`, lockfile npm, servidor próprio ou configuração Playwright.

A entrada atual é `ORIGENS — Survival v0.3.html`: Canvas 2D `#c` de 960×540, redimensionado por CSS, com mapa procedural e atlas gráficos gerados inline. O menu de mundos usa DOM; mundo, personagem, HUD, minimapa e mapa completo são desenhados no Canvas. Existem movimento WASD, coleta e saves v3. Não existe escolha de origem elemental; os elementos nas ilhas são biomas, não uma seleção de personagem.

## Infraestrutura entregue

- `@playwright/test` **1.65.0** como única dependência direta de desenvolvimento, com versão exata e `package-lock.json`.
- Servidor HTTP em Node, sem dependências de runtime, escutando somente em `127.0.0.1:4173`. `/` serve o HTML v0.3 sem alterar seus bytes.
- `webServer` inicia e encerra o servidor da suíte. Não reutiliza servidores desconhecidos já ativos na porta.
- Projeto Chromium, dois workers, contextos isolados, timeout explícito e nenhum retry automático.
- Relatório HTML; screenshot e trace automáticos em falhas; evidências JSON para erros detectados pela fixture.
- `.gitignore` para dependências, relatórios e resultados temporários.

## Execução confirmada

Ambiente usado: Node **24.22.1**, npm **11.9.0**, Playwright **1.65.0**, Chromium do sistema **155.0.8059.79**.

O Chromium foi efetivamente iniciado pela API do Playwright; uma verificação preliminar desenhou e leu pixels de Canvas. A instalação npm foi concluída pelo proxy configurado após a sandbox bloquear a primeira tentativa de conexão. O lockfile também foi validado com uma reinstalação `npm ci` usando o cache local, sem mudar versões.

Comando completo executado com saída 0:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

Resultados:

| Verificação | Aprovados | Reprovados | Ignorados/não executados |
| --- | ---: | ---: | ---: |
| Suíte existente Node/VM | 29 grupos | 0 | 0 |
| Playwright no Chromium | 8 testes | 0 | 1 |

O único teste ignorado é a escolha de origem elemental, por não estar implementada. Ele aparece explicitamente no relatório do runner. Nenhum teste executado foi desabilitado para esconder falhas.

Depois da revisão, foi adicionada uma asserção para comparar pixels do minimapa visível com seu Canvas de origem. A suíte Playwright final foi executada novamente: **8 aprovados, 0 reprovados, 1 ignorado**, aproximadamente **6 segundos**, com saída 0 e `test-results/.last-run.json` indicando `passed` e nenhuma falha.

### Cobertura dos oito testes

1. Documento, resolução Canvas, menu, troca da seed e criação de mundo pelos controles reais.
2. Mundo válido, terreno, ilhas, oceano, exploração, pixels de terreno/personagem e minimapa tanto offscreen quanto no Canvas visível.
3. Recursos essenciais inline: atlas de terreno, árvores, pedras, cristais, juncos e conchas com conteúdo não transparente.
4. WASD por teclado real, deslocamento nos eixos esperados e posição sem colisão sólida.
5. Mapa completo com raster visível, pausa do movimento, zoom, arrasto e retomada após Esc.
6. Zoom do mundo, debug, botão de revelar mapa e retorno ao menu funcional.
7. Gravação pelo fluxo existente, recarga real da página, retomada pelo botão Jogar e novo movimento.
8. Recarga antes de criar mundo, seguida de criação funcional pelo menu.

A fixture verifica exceções JavaScript, erros de console, requisições falhadas e respostas HTTP de erro ao longo dos testes, inclusive após recarregar. Não houve erros inesperados detectados nas execuções finais. As asserções de pixels, estado e interação complementam essa verificação: ausência de erro não foi usada como única prova.

Uma checagem HTTP adicional confirmou que a rota inicial e ambos os HTMLs são servidos byte a byte, caminhos privados retornam 404, favicon retorna 204 e HEAD responde corretamente.

## Preservação e limitações

Os dois HTMLs foram comparados por SHA-256 antes/depois e permaneceram idênticos. Os testes anteriores e o relatório v0.3 também foram mantidos. Não houve alteração de jogabilidade, gerador, sprites, controles, formatos de save ou progressão, nem inclusão de hooks no jogo. Os testes Playwright apenas leem o estado existente por `page.evaluate`; as ações usam mouse/teclado e o menu real.

Não foi identificado bug de jogabilidade nos cenários executados. Esta suíte é uma verificação funcional inicial, não prova de funcionamento completo de todos os sistemas, seeds, tamanhos ou partidas prolongadas. A suíte Node existente também confirmou geração válida e determinística nos quatro tamanhos disponíveis.

O Chromium do sistema foi reutilizado com a variável documentada, sem baixar navegador adicional. O Chromium gerenciado pelo Playwright não foi instalado nem validado nesta máquina. Em instalações comuns, `npm run test:e2e:install` prepara a versão compatível; o modo de navegador visível, outros navegadores e outras plataformas não foram executados nesta tarefa.

No Codex Cloud, a sandbox exigiu execução autorizada para acessar o npm, iniciar o navegador e usar loopback. Esses passos foram realizados com sucesso; não há bloqueio pendente. A validação do jogo ocorreu por HTTP, como configurado por `webServer`. Nenhuma política de rede ou verificação TLS foi desativada.

Não houve falhas que exigissem screenshot: a captura está configurada para falhas reais, em `test-results/`. O relatório HTML da última execução foi gerado em `playwright-report/`; ambos os diretórios são ignorados pelo Git.

## Arquivos criados e modificados

Arquivos novos nesta tarefa:

- `package.json`
- `package-lock.json`
- `playwright.config.js`
- `.gitignore`
- `scripts/serve.cjs`
- `tests/e2e/fixtures.js`
- `tests/e2e/origens.spec.js`
- `README.md`
- `RELATORIO-PLAYWRIGHT.md`

Nenhum arquivo preexistente foi modificado. `node_modules`, relatórios e resultados foram gerados localmente e não fazem parte dos arquivos para versionar.

## Como repetir

Em uma máquina com download do Chromium disponível, na pasta do repositório:

```sh
npm ci
npm run test:e2e:install
npm run test:e2e
```

Neste ambiente, que já possui Chromium:

```sh
cd /workspace/teste2
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Para executar também os testes existentes, substitua `npm run test:e2e` por `npm test`. O servidor é gerenciado automaticamente; não é preciso iniciar uma sessão CDP nem executar o script de navegador legado. Mais comandos e detalhes estão em `README.md`.
