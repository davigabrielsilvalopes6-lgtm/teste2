# Salamandra Ígnea — referência e plano de animação

**Status: base visual; folhas finais de produção pendentes.** Esta entrega usa a alternativa prevista no pedido: referência e plano primeiro quando o gerador não consegue produzir folhas técnicas confiáveis. Não foi adicionada uma criatura ao jogo.

## Material recebido e produzido

O ZIP recebido contém referências aprovadas de quatro criaturas. Apenas `salamandra_ignea_aprovada.png` foi usada nesta tarefa. As outras espécies não foram alteradas nem incluídas no pacote desta salamandra.

- `reference/salamandra_ignea_aprovada.png`: a prancha original enviada, preservada byte a byte. É PNG RGB de 1536 × 1024, com legendas, divisórias e fundo quadriculado desenhado. O quadriculado **não é transparência real**.
- `reference/salamandra_ignea_estudo_idle_4_direcoes.png`: estudo gerado a partir da salamandra aprovada, com quatro direções e propostas sutis de idle. PNG RGBA de 1254 × 1254, com transparência real. O original da geração também foi mantido fora do repositório em `/workspace/generated_images`.
- `animation_plan.json`: plano dos 108 frames da criatura e quatro do projétil, com direção, dimensões esperadas, âncora proposta, fases e tempos sugeridos. **Não contém coordenadas válidas para recortar o estudo.**
- `VALIDACAO.json`: medidas e verificações reais, incluindo os arquivos finais ainda ausentes.

O estudo mantém uma salamandra baixa, de quatro patas, cauda longa, cabeça larga, pele avermelhada e manchas de brasa. Serve para revisão artística. A presença das quatro direções foi conferida visualmente; isso não valida anatomia e continuidade de todos os futuros frames.

## Por que o estudo não é uma sprite sheet pronta

A geração foi instruída a produzir uma folha de idle em células 64 × 64, sem suavização. O resultado veio com **1254 × 1254**, dimensão que não se divide por 64 nem por quatro células inteiras. Também possui alfa parcial nas bordas e muitas cores, exigindo limpeza de pixels e redução de paleta.

Renomear a imagem, redimensioná-la inteira ou simplesmente dividi-la em quatro não comprova alinhamento, proporções, pés fixos ou ciclos naturais. Por isso não foram criados arquivos com nomes de folhas finais contendo uma imagem de referência disfarçada. Também não foram duplicadas poses estáticas para alegar animações completas.

## Folhas finais que precisam ser produzidas/corrigidas

| Arquivo final                    | Grade | Dimensões | Estado                                                         |
| -------------------------------- | ----- | --------- | -------------------------------------------------------------- |
| `salamandra_ignea_idle.png`      | 4 × 4 | 256 × 256 | Pendente: redesenho/limpeza no grid nativo a partir do estudo. |
| `salamandra_ignea_walk.png`      | 6 × 4 | 384 × 256 | Pendente: locomação quadrúpede completa.                       |
| `salamandra_ignea_fire_spit.png` | 6 × 4 | 384 × 256 | Pendente: antecipação, garganta, abertura, emissão e retorno.  |
| `salamandra_ignea_bite.png`      | 4 × 4 | 256 × 256 | Pendente: preparação e fechamento rápido da mandíbula.         |
| `salamandra_ignea_hurt.png`      | 2 × 4 | 128 × 256 | Pendente: recuo e recuperação.                                 |
| `salamandra_ignea_death.png`     | 5 × 4 | 320 × 256 | Pendente: queda e acomodação, sem sangue.                      |
| `salamandra_ignea_fireball.png`  | 4 × 1 | 64 × 16   | Pendente: quatro frames 16 × 16, separados da criatura.        |

Também está pendente `salamandra_ignea_preview.png`, que deverá comparar um **frame final real de 64 × 64 em escala 1:1** com sua ampliação inteira por nearest-neighbor. A prancha recebida e o estudo gerado não são uma demonstração verificada de escala nativa.

Todas as folhas da criatura deverão ter linhas **down, up, left, right**, nessa ordem. Sem bordas, legendas, linhas de grade ou espaço entre células. O plano propõe apoio em `(32, 44)`, a validar no desenho nativo, e escala uniforme em todas as animações. A bola de fogo usa pivô próprio e nunca fica incorporada ao sprite do corpo.

## Plano artístico

A paleta proposta é a do pedido: `#382326`, `#56302B`, `#873B30`, `#B94B34`, `#E97839`, `#F4A14C`, `#FFD477`. A luz vem de cima à esquerda; o contorno é escuro e colorido. As peças finais precisam de pixels duros e alfa 0/255, sem blur, degradê contínuo ou halo.

A vista lateral deverá ocupar aproximadamente 36–44 × 24–36 pixels dentro da célula de 64 × 64. Manter o mesmo tamanho, manchas, cabeça e comprimento da cauda. As patas podem ficar parcialmente ocultas pela perspectiva, mas a anatomia deve continuar quadrúpede; não desenhar patas adicionais nem removê-las entre poses.

O JSON detalha cada fase. Na caminhada, alternar os pares de apoio com flexão discreta do tronco e cauda; o primeiro e o último frames precisam ligar sem salto. No fogo, usar alerta, recuo, garganta iluminada, mandíbula aberta, emissão e retorno. O evento de emissão proposto é o índice 4, contando a partir de zero, com projétil separado. Na morte, flexionar as patas e acomodar corpo e cauda; preservar a pose final.

Os tempos são sugestões para revisão da animação, não regras de dano, cooldown, velocidade ou inteligência artificial. A integração futura deverá validar os eventos contra o combate existente.

## Validação executada

Foi inspecionada a referência aprovada e o estudo gerado. A auditoria confirmou dimensões, formato, alfa real/falso, quantidade de cores, hashes e a ausência das sete folhas finais. Conferiu também as contagens do plano: **108 + 4 = 112 frames**.

```sh
python scripts/audit-fire-salamander-assets.py
python scripts/audit-fire-salamander-assets.py --strict
```

O script exige Pillow, já disponível no ambiente de trabalho. O primeiro comando gera a auditoria de referência/plano. O segundo termina com **código 2 enquanto as folhas e a revisão visual estiverem pendentes**; não é um teste de produção aprovado. Não há novas dependências do jogo.

A auditoria não consegue comprovar automaticamente quatro patas em cada pose, identidade das manchas, ordem semântica das direções, mordida convincente ou um loop natural. Essas revisões permanecem pendentes para as folhas finais.

O jogo v0.8.1, seus salvamentos, controles, combate e configurações não foram modificados. Não foi executada novamente a suíte completa do jogo porque nenhum código ou asset carregado pelo jogo mudou.
