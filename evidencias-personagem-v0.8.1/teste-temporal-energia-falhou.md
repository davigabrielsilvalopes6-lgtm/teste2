# Test info

- Name: combat.spec.js >> staff and spear recipes, projectile hits and special costs use real mouse controls
- Location: tests/e2e/combat.spec.js:145:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 1
Received:   1.0998000000000012
```

# Page snapshot

```yaml
- generic [ref=e2]:
    - region "Atributos do personagem" [ref=e4]:
        - generic [ref=e5]:
            - text: VIDA
            - strong [ref=e6]: 100/100
            - progressbar "Vida" [ref=e7]
        - generic [ref=e8]:
            - text: VIGOR
            - strong [ref=e9]: 100/100
            - progressbar "Vigor" [ref=e10]
        - generic [ref=e11]:
            - text: ENERGIA
            - strong [ref=e12]: 9/100
            - progressbar "Energia elemental" [ref=e13]
        - status
    - complementary "Modo de treinamento" [ref=e14]:
        - strong [ref=e15]: TREINAMENTO DE DESENVOLVIMENTO
        - generic [ref=e16]: Use um mundo de teste. Não há inimigos ou loot.
        - button "Criar/repor alvos próximos" [ref=e17] [cursor=pointer]
        - 'button "Simular dano: 10" [ref=e18] [cursor=pointer]'
        - button "Testar derrota" [ref=e19] [cursor=pointer]
        - button "Recuperar atributos de teste" [ref=e20] [cursor=pointer]
    - 'toolbar "Barra rápida: espaços 1 a 9 da mochila" [ref=e21]':
        - 'button "Atalho 1: Cajado de Treinamento, 1 de 1" [pressed] [ref=e22] [cursor=pointer]':
            - generic [ref=e23]: '1'
        - 'button "Atalho 2: vazio" [ref=e24] [cursor=pointer]':
            - generic [ref=e25]: '2'
        - 'button "Atalho 3: Lança Primitiva, 1 de 1" [ref=e26] [cursor=pointer]':
            - generic [ref=e27]: '3'
        - 'button "Atalho 4: vazio" [ref=e28] [cursor=pointer]':
            - generic [ref=e29]: '4'
        - 'button "Atalho 5: vazio" [ref=e30] [cursor=pointer]':
            - generic [ref=e31]: '5'
        - 'button "Atalho 6: vazio" [ref=e32] [cursor=pointer]':
            - generic [ref=e33]: '6'
        - 'button "Atalho 7: vazio" [ref=e34] [cursor=pointer]':
            - generic [ref=e35]: '7'
        - 'button "Atalho 8: vazio" [ref=e36] [cursor=pointer]':
            - generic [ref=e37]: '8'
        - 'button "Atalho 9: vazio" [ref=e38] [cursor=pointer]':
            - generic [ref=e39]: '9'
```

# Test source

```ts
  83  |   await gatherNatural(page, 2, 4);
  84  |   await page.keyboard.press('c');
  85  |   for (const id of [
  86  |     'stick',
  87  |     'plank',
  88  |     'chipped_stone',
  89  |     'chipped_stone',
  90  |     'simple_handle',
  91  |     'primitive_sword',
  92  |   ])
  93  |     await craft(page, id);
  94  |   await page.keyboard.press('c');
  95  |   await equip(page, 'primitive_sword');
  96  |   await page.locator('#training-targets').click();
  97  |   const approach = await page.evaluate(() => {
  98  |     for (const t of G.combat.targets) {
  99  |       const dx = t.x - G.px,
  100 |         dy = t.y - (G.py - 12),
  101 |         d = Math.hypot(dx, dy),
  102 |         x = G.px + (dx / d) * 22,
  103 |         y = G.py + (dy / d) * 22;
  104 |       let clear = true;
  105 |       for (let i = 1; i <= 8; i++)
  106 |         if (blocked(G.w, G.px + ((x - G.px) * i) / 8, G.py + ((y - G.py) * i) / 8, 0))
  107 |           clear = false;
  108 |       if (clear) return { target: { id: t.id, x: t.x, y: t.y }, point: { x, y } };
  109 |     }
  110 |     return null;
  111 |   });
  112 |   expect(approach).not.toBeNull();
  113 |   await moveTo(page, approach.point.x, approach.point.y);
  114 |   await page.waitForTimeout(400);
  115 |   await aim(page, approach.target);
  116 |   await aim(page, approach.target);
  117 |   await expect
  118 |     .poll(() =>
  119 |       page.evaluate((id) => G.combat.targets.find((t) => t.id === id).health, approach.target.id),
  120 |     )
  121 |     .toBe(88);
  122 |   await page.waitForTimeout(550);
  123 |   await aim(page, approach.target, 'right');
  124 |   await expect
  125 |     .poll(() =>
  126 |       page.evaluate((id) => G.combat.targets.find((t) => t.id === id).health, approach.target.id),
  127 |     )
  128 |     .toBe(64);
  129 |   const stamina = await page.evaluate(() => G.combat.stats.stamina);
  130 |   expect(stamina).toBeLessThanOrEqual(81);
  131 |   expect(stamina).toBeGreaterThanOrEqual(80);
  132 |   await expect(page.locator('#combat-stamina')).toHaveJSProperty('value', stamina);
  133 |   await page.screenshot({ path: testInfo.outputPath('espada-treino.png') });
  134 |   const inventory = await page.evaluate(() => JSON.stringify(G.inventory.slots));
  135 |   await page.keyboard.press('Escape');
  136 |   await expect(page.locator('#m')).toBeVisible();
  137 |   await page.reload();
  138 |   await load(page, name);
  139 |   expect(await page.evaluate(() => JSON.stringify(G.inventory.slots))).toBe(inventory);
  140 |   expect(await page.evaluate(() => activeWeapon().id)).toBe('primitive_sword');
  141 |   expect(await page.evaluate(() => G.combat.projectiles.length)).toBe(0);
  142 |   expect(await page.evaluate(() => G.combat.active)).toBeNull();
  143 | });
  144 |
  145 | test('staff and spear recipes, projectile hits and special costs use real mouse controls', async ({
  146 |   page,
  147 | }, testInfo) => {
  148 |   await training(page);
  149 |   await page.evaluate(() => {
  150 |     addItems(G.inventory, 'simple_handle', 3);
  151 |     addItems(G.inventory, 'chipped_stone', 4);
  152 |     addItems(G.inventory, 'ore', 1);
  153 |     addItems(G.inventory, 'stick', 3);
  154 |     inventoryChanged();
  155 |   });
  156 |   await page.keyboard.press('c');
  157 |   await craft(page, 'training_staff');
  158 |   await craft(page, 'primitive_spear');
  159 |   await page.keyboard.press('c');
  160 |   await equip(page, 'training_staff');
  161 |   // A bounded target fixture makes the projectile timing inspectable; damage and input remain real.
  162 |   const target = await page.evaluate(() => {
  163 |     G.combat.targets = [
  164 |       { id: 'ranged', x: G.px + 36, y: G.py - 12, radius: 12, health: 100, maxHealth: 100 },
  165 |     ];
  166 |     return { x: G.px + 36, y: G.py - 12 };
  167 |   });
  168 |   await aim(page, target);
  169 |   await expect.poll(() => page.evaluate(() => G.combat.targets[0].health)).toBe(92);
  170 |   await page.waitForTimeout(600);
  171 |   await aim(page, target, 'right');
  172 |   await expect.poll(() => page.evaluate(() => G.combat.targets[0].health)).toBe(76);
  173 |   expect(await page.evaluate(() => G.combat.stats.elementalEnergy)).toBeLessThan(81);
  174 |   await expect(page.locator('#combat-elementalEnergy')).toHaveJSProperty(
  175 |     'value',
  176 |     await page.evaluate(() => G.combat.stats.elementalEnergy),
  177 |   );
  178 |   await page.waitForTimeout(3100);
  179 |   await page.evaluate(() => {
  180 |     G.combat.stats.elementalEnergy = 0;
  181 |   });
  182 |   await aim(page, target, 'right');
> 183 |   expect(await page.evaluate(() => G.combat.stats.elementalEnergy)).toBeLessThan(1);
      |                                                                     ^ Error: expect(received).toBeLessThan(expected)
  184 |   expect(await page.evaluate(() => G.combat.stats.elementalEnergy)).toBeGreaterThanOrEqual(0);
  185 |   expect(await page.evaluate(() => G.combat.projectiles.length)).toBe(0);
  186 |   await equip(page, 'primitive_spear');
  187 |   await page.waitForTimeout(600);
  188 |   await aim(page, target);
  189 |   await expect.poll(() => page.evaluate(() => G.combat.targets[0].health)).toBe(61);
  190 |   await page.screenshot({ path: testInfo.outputPath('cajado-lanca.png') });
  191 | });
  192 |
  193 | test('Space dodge spends vigor and returns controls; recovery follows time instead of draw count', async ({
  194 |   page,
  195 | }) => {
  196 |   await training(page);
  197 |   const before = await page.evaluate(() => ({ x: G.px, y: G.py }));
  198 |   await page.keyboard.down('d');
  199 |   await page.keyboard.press('Space');
  200 |   await page.keyboard.up('d');
  201 |   await expect.poll(() => page.evaluate(() => G.combat.dodge === null)).toBe(true);
  202 |   const after = await page.evaluate(() => ({ x: G.px, y: G.py, stamina: G.combat.stats.stamina }));
  203 |   expect(after.x - before.x).toBeGreaterThan(25);
  204 |   expect(after.x - before.x).toBeLessThan(56);
  205 |   expect(after.stamina).toBeLessThan(81);
  206 |   await page.keyboard.press('Space');
  207 |   expect(await page.evaluate(() => G.combat.stats.stamina)).toBeLessThan(81);
  208 |   await expect
  209 |     .poll(() => page.evaluate(() => G.combat.stats.stamina), { timeout: 4000 })
  210 |     .toBeGreaterThan(88);
  211 | });
  212 |
  213 | test('simulated damage, immunity, defeat and recovery update actual HUD without changing inventory', async ({
  214 |   page,
  215 | }, testInfo) => {
  216 |   await training(page);
  217 |   await seedWeapon(page, 'primitive_sword');
  218 |   const inv = await page.evaluate(() => JSON.stringify(G.inventory.slots));
  219 |   await page.locator('#training-damage').click();
  220 |   await page.locator('#training-damage').click();
  221 |   await expect(page.locator('#combat-health')).toHaveJSProperty('value', 90);
  222 |   await page.waitForTimeout(550);
  223 |   await page.locator('#training-defeat').click();
  224 |   await expect(page.locator('#combat-defeat')).toBeVisible();
  225 |   await expect(page.locator('#combat-health')).toHaveJSProperty('value', 0);
  226 |   const point = await page.evaluate(() => ({ x: G.px + 30, y: G.py - 12 }));
  227 |   await aim(page, point);
  228 |   expect(await page.evaluate(() => G.combat.active)).toBeNull();
  229 |   expect(await page.evaluate(() => JSON.stringify(G.inventory.slots))).toBe(inv);
  230 |   await page.screenshot({ path: testInfo.outputPath('derrota-teste.png') });
  231 |   await page.locator('#training-recover').click();
  232 |   await expect(page.locator('#combat-health')).toHaveJSProperty('value', 100);
  233 |   expect(await page.evaluate(() => JSON.stringify(G.inventory.slots))).toBe(inv);
  234 | });
  235 |
  236 | test('inventory, crafting, map, cursor and raft reject mouse attacks without consumption', async ({
  237 |   page,
  238 | }) => {
  239 |   await training(page);
  240 |   await seedWeapon(page, 'primitive_sword');
  241 |   await page.keyboard.press('i');
  242 |   const original = await page.evaluate(() => G.combat.stats.stamina);
  243 |   await page.keyboard.press('Space');
  244 |   await page.locator('#inventory-grid [data-slot="0"]').click({ button: 'right' });
  245 |   expect(await page.evaluate(() => G.combat.active)).toBeNull();
  246 |   expect(await page.evaluate(() => G.combat.stats.stamina)).toBe(original);
  247 |   await page.locator('#inventory-grid [data-slot="0"]').click();
  248 |   await page.keyboard.press('i');
  249 |   await page.keyboard.press('c');
  250 |   await page.locator('[data-recipe="recipe_primitive_sword"]').click();
  251 |   expect(await page.evaluate(() => G.combat.active)).toBeNull();
  252 |   await page.keyboard.press('c');
  253 |   await page.keyboard.press('m');
  254 |   await aim(page, await page.evaluate(() => ({ x: G.px + 30, y: G.py - 12 })), 'right');
  255 |   expect(await page.evaluate(() => G.combat.active)).toBeNull();
  256 |   await page.keyboard.press('m');
  257 |   await page.evaluate(() => {
  258 |     G.boat = 1;
  259 |   });
  260 |   await aim(page, await page.evaluate(() => ({ x: G.px + 30, y: G.py - 12 })), 'right');
  261 |   await page.keyboard.press('Space');
  262 |   expect(await page.evaluate(() => G.combat.active)).toBeNull();
  263 |   expect(await page.evaluate(() => G.combat.stats.stamina)).toBe(original);
  264 | });
  265 |
  266 | for (const size of [
  267 |   { width: 1280, height: 800 },
  268 |   { width: 640, height: 480 },
  269 | ])
  270 |   test(`weapon pixels and real progress bars remain visible at ${size.width}×${size.height}`, async ({
  271 |     page,
  272 |   }, testInfo) => {
  273 |     await page.setViewportSize(size);
  274 |     await openMenu(page);
  275 |     await createWorld(page);
  276 |     await seedWeapon(page, 'primitive_sword');
  277 |     await page.waitForTimeout(1000);
  278 |     const raster = () =>
  279 |       page.evaluate(() => {
  280 |         const x = Math.round((G.px - G.view.ox) * G.view.z),
  281 |           y = Math.round((G.py - G.view.oy) * G.view.z);
  282 |         return Array.from(ctx.getImageData(x - 48, y - 64, 96, 80).data);
  283 |       });
```
