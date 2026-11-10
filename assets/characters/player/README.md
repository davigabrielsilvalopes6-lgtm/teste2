# Personagem oficial do ORIGENS

Origem: ZIP `ORIGENS_personagem_4_lados_animacao.zip`, enviado pelo usuário. Os quatro arquivos de `source/` mantêm os bytes recebidos.

| Arquivo                                    | Dimensões         | Uso                                                                                 |
| ------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------- |
| `source/personagem_normal.png`             | 1536 × 1024, RGB  | Referência estática, fundo escuro sem canal alfa; não é carregada no jogo.          |
| `source/personagem_4_lados.png`            | 1254 × 1254, RGBA | Referência de frente, costas, esquerda e direita; não é uma grade técnica validada. |
| `source/personagem_animacao_caminhada.png` | 1330 × 1182, RGBA | Fonte das seis poses por direção.                                                   |
| `source/LEIA_ME.txt`                       | Texto original    | Confirma que são referências, não uma folha pronta em 48 × 64.                      |
| `player-walk-atlas.png`                    | 1152 × 1088, RGBA | Atlas técnico: seis colunas, quatro linhas, células de 192 × 272.                   |
| `player_animations.json`                   | JSON              | Recortes, hash da origem, direções, âncora, escala e recursos ausentes.             |

Linhas do atlas: down, up, left, right. Âncora comum: `(96, 264)`. A arte é copiada na resolução nativa, com padding transparente; o desenho no mundo usa escala uniforme de 0,125 (célula de 24 × 34 unidades), sem suavização. Os pés e o eixo central do recorte principal ficam alinhados. Não há espelhamento, recoloração, redesenho, remoção de roupas ou geração de pixels. O alfa parcial e pequenas variações entre as poses pertencem às referências recebidas.

O atlas contém o **visual original completo**, não camadas independentes. Corpo, cabelo, camisa, calça e botas não podem ser separados com fidelidade sem novos arquivos. Também faltam alternativas de roupas, corpo-base neutro e ciclos próprios de idle/combate. O idle usa a primeira pose da caminhada; ataques e esquivas usam essa pose com as representações de equipamento e efeitos já existentes.

O HTML incorpora os bytes deste atlas em uma URI `data:image/png;base64`. Nenhuma imagem é baixada ao iniciar o jogo. O carregador mantém uma única imagem decodificada em cache, valida suas dimensões e informa falhas sem substituir a aparência salva.

Para reproduzir o recorte técnico, o script de desenvolvimento `python scripts/prepare-player-assets.py` usa Pillow, NumPy e SciPy. Esses pacotes não são usados pelo jogo nem pelo comando `npm test`. Se o atlas for alterado, sua cópia incorporada no HTML também precisa ser atualizada; `tests/appearance.test.cjs` verifica a igualdade dos bytes.

Para verificar fidelidade dos 24 recortes independentemente do gerador:

```sh
python tests/verify-player-assets.py
```

A verificação exige Pillow e compara todos os bytes RGBA copiados com as regiões correspondentes do arquivo recebido, além de limites, transparência, frames distintos e alinhamento dos pés.
