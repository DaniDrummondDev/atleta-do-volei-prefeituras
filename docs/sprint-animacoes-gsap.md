# Sprint — Camada de animação GSAP

## Objetivo

Elevar a landing page de "reveals com IntersectionObserver" para uma
experiência de scroll narrativa: entrada cinematográfica no hero, cenas
pinadas, duas faixas de scroll horizontal e microinterações — sem
comprometer acessibilidade nem criar dependência dura de CDN.

## Arquitetura

Camada **aditiva e reversível**, sobreposta ao site existente.

```
index.html
 ├─ <head>  animations.css + script inline que aplica `html.gsap-ready`
 └─ <body>  gsap → ScrollTrigger → ScrollToPlugin → animations.js → script.js

animations.css   estados, layout do scroll horizontal, header fixo   (novo)
animations.js    toda a orquestração GSAP                            (novo)
styles.css       intocado
script.js        1 guard adicionado (menu/FAQ/form inalterados)
map.js           intocado
```

### O interruptor `gsap-ready`

Quase toda regra de `animations.css` está sob `html.gsap-ready`.

1. Um script inline no `<head>` aplica a classe **antes do primeiro
   paint** (evita flash entre layout estático e animado), exceto se
   `prefers-reduced-motion: reduce`.
2. `animations.js` **remove** a classe se `window.gsap` ou
   `window.ScrollTrigger` não existirem (CDN fora do ar).
3. Sem a classe: layout original, `.reveal` original, zero pin, zero
   scroll horizontal. A página degrada para exatamente o que era antes.

`animations.js` também expõe `window.__gsapEnhanced`; `script.js` só
liga o IntersectionObserver quando essa flag é falsa — as duas camadas
nunca animam o mesmo elemento.

## Decisões técnicas

| Decisão | Motivo |
|---|---|
| `body { overflow-x: clip }` sob `gsap-ready` | `hidden` cria containing block e quebra o `position:fixed` do pin do ScrollTrigger. `clip` corta igual sem esse efeito |
| `scroll-behavior: smooth` desligado; âncoras via ScrollToPlugin | Scroll suave nativo disputa a posição com o pin e erra o alvo |
| Split de texto próprio (`splitWords`/`splitChars`) | SplitText é plugin pago. O nosso caminha na árvore e preserva `<em>`, `<span>`, `<br>` — o `<h1>` do hero depende disso |
| Cards da plataforma entram com a mesma animação | O mapa Leaflet está no plano de fundo da seção, fora das transformações dos cards |
| `ScrollTrigger.refresh()` em `load`, `fonts.ready` e `+1200ms` | O mapa monta assíncrono e muda a altura da seção; sem refresh todos os triggers abaixo ficam deslocados |
| Cenas pinadas só em `min-width: 901px`, via `gsap.matchMedia` | Pin em mobile prejudica leitura e desempenho; o matchMedia desmonta e restaura sozinho no resize |
| Scroll horizontal pina o `.hscroll-viewport` (100vh) e não a `<section>` | Pinar um elemento mais alto que a viewport corta conteúdo |
| Cabeçalho da seção **dentro** do pin (`.hscroll-head`) | O título permanece na tela enquanto os cards passam — sem ele o usuário perde contexto |
| `distance()` como função + `invalidateOnRefresh` | A distância depende de `innerWidth` e precisa recalcular em resize |

## Estrutura do scroll horizontal

Há **dois formatos** de faixa horizontal, ambos servidos pela mesma
função `horizontalScene()` em `animations.js` §7.

### A) Faixa de cards — Na prática, Como implementamos

```html
<section class="practice section">
  <div class="hscroll-viewport">            <!-- pinado, 100vh -->
    <div class="hscroll-inner">
      <div class="container hscroll-head">…título…</div>
      <div class="practice-grid hscroll-track">…cards…</div>
    </div>
  </div>
</section>
```

Sem `gsap-ready`, `viewport`/`inner` são divs neutros e `.practice-grid`
volta ao `display:grid` de 4 colunas do `styles.css`.

### B) A JORNADA — 4 seções inteiras em painéis de tela cheia

```html
<div class="journey hscroll-viewport" id="ganhos">   <!-- pinado -->
  <div class="journey-track hscroll-track">
    <section class="statement section journey-panel">…</section>  <!-- Ganhos -->
    <section class="problem   section journey-panel">…</section>  <!-- Desafio -->
    <section class="transform section journey-panel">…</section>  <!-- Transformação -->
    <section class="position  section journey-panel">…</section>  <!-- Posicionamento -->
  </div>
  <div class="journey-nav">…progresso + 4 rótulos…</div>
</div>
```

Cada painel é `100vw × 100vh`. O usuário atravessa quatro seções
completas sem sair do lugar; a `.journey-nav` no rodapé mostra a barra
de progresso e destaca o painel ativo — sem ela o usuário perde a
noção de onde está durante um pin longo.

O `id="ganhos"` migrou da `<section>` para o wrapper: rolar até um
elemento dentro de um track transladado em X devolve posição errada.

**Ponto-chave de manutenção:** `initJourneyPanels(container)` descreve
as animações dos 4 painéis **uma única vez**. Recebe a timeline
horizontal no desktop e `null` no mobile — as mesmas cenas rodam nos
dois layouts, sem duas listas divergindo com o tempo. O helper
`onEnter(trigger, extra, container)` traduz automaticamente
`start: 'top 82%'` (vertical) para `start: 'left 80%'` (horizontal);
use a chave `startH` para ajustar só o modo horizontal.

### A cena "A grande transformação"

Roda com `scrub` — o usuário dirige a sequência com o próprio scroll:

1. card **ANTES** entra e seus itens caem um a um;
2. a seta gira 200° e cresce;
3. o card **COM ATLETA DO VÔLEI** entra pela direita e ganha sombra.

**Requisito explícito:** o card ANTES *permanece em cena* até o fim. É o
contraste que dá sentido ao "depois". Nenhum passo desta timeline reduz
a opacidade ou remove o `.transform-before` — se for mexer aqui,
preserve isso.

## Mapa das cenas (`animations.js`)

| § | Cena | Efeito |
|---|---|---|
| 3 | Chrome | Barra de progresso; header fixo com auto-hide + blur; âncoras suaves |
| 4 | Hero | Timeline de entrada com máscara por palavra; parallax de saída em 5 camadas |
| **6** | **JORNADA — PIN horizontal (4 painéis)** | Ganhos → Desafio → Transformação → Posicionamento, com nav de progresso |
| 6 | ↳ Ganhos | Cards em stagger 3D; ícones com `back.out` |
| 6 | ↳ Desafio | Lista por `clip-path`; fecho revelado caractere a caractere |
| 6 | ↳ Transformação | Cena por scrub: ANTES entra e **fica**, seta gira, DEPOIS entra |
| 6 | ↳ Posicionamento | Lead por palavras; colunas de lados opostos; listas em cascata coluna a coluna |
| 5 | Rede (O grande diferencial) | Nós **orbitam** o núcleo; anéis por scrub; halo pulsando; texto e check-list animados. Ver abaixo |
| 5 | Plataforma | Deck de cards; mini-UIs em parallax interno |
| 5 | Benefícios | Imagem em parallax; numeração 01–06 com contador |
| 5 | FAQ / CTA | Stagger e parallax do padrão de fundo |
| **7** | **Na prática — PIN horizontal** | Cards endireitam ao cruzar a tela |
| **7** | **Como implementamos — PIN horizontal** | Trilha coral progressiva; números com `back.out` |
| 8 | Microinterações | Botões magnéticos e tilt 3D — só em `(hover:hover) and (pointer:fine)` |

## A órbita da seção "O grande diferencial"

O truque central: **um wrapper por nó, criado em tempo de execução**.

```
.network-visual (position: relative, centro em 50%/50%)
 └─ .node-orbit      ← inset:0, cobre TODO o visual; é ele que gira
     └─ .node        ← mantém seu top/left original; gira ao contrário
```

Girar o `.node-orbit` faz o nó descrever um círculo em torno do centro
do visual — que é exatamente onde está o `.network-center`. O raio sai
de graça: é a distância do nó ao centro (~209px nos quatro). O nó recebe
`rotate: -360` na **mesma duração e com ease linear**, então as duas
rotações se cancelam quadro a quadro e o texto nunca sai da horizontal
(efeito roda-gigante).

Por que o wrapper não está no HTML: sem GSAP ele seria um `<div>` vazio
sem função. Como tem `inset: 0`, o `top/left` de cada `.node` continua
valendo exatamente como antes — o wrap é transparente para o layout.

Detalhes de comportamento:

- **A órbita só começa depois da entrada dos nós** (`onComplete`). Se
  girasse durante, os eixos `x/y` do nó já estariam rotacionados e o
  movimento de entrada sairia torto.
- **Rolar acelera a órbita** (até 6×, por `getVelocity()`), e ela
  desacelera sozinha após 0,35s parado.
- **Fora da tela, órbita e pulso pausam** — nenhum frame gasto com o que
  ninguém vê.
- `.ring-b` ganhou borda tracejada (só sob `gsap-ready`): num anel liso
  a rotação é invisível.
- Volta completa em **46s** (`ORBIT_SECONDS`). É ambiente, não
  protagonista — se quiser mais evidente, baixe esse número.

## Scroll lock — "para, anima, libera"

Ao alcançar uma seção de `LOCKED_SECTIONS` (§2b de `animations.js`), a
página alinha a seção, **trava o scroll**, roda a sequência inteira e
destrava. Uma vez por seção.

Hoje: `['.network', '.features', '.benefits']`. As seções pinadas
(`.journey`, `.practice`, `.steps`) não entram — já seguram a tela.

Tirar o controle do scroll do usuário é agressivo. Por isso há **quatro
saídas de emergência, e nenhuma delas deve ser removida**:

1. failsafe por tempo (duração da cena + folga, teto `HARD_CAP` = 5s);
2. **Esc** destrava na hora;
3. duas tentativas de rolar destravam — se a pessoa insiste, ela ganha;
4. `once`: nunca trava a mesma seção duas vezes.

Ao cancelar, a timeline salta para o fim (`progress(1)`) — ninguém fica
com meia animação na tela.

## BUG CORRIGIDO: ordem de criação dos ScrollTriggers

**Sintoma:** "O grande diferencial" aparecia completamente estática — os
círculos orbitavam (animação contínua), mas todo o texto e a entrada dos
nós já tinham acontecido.

**Causa:** as cenas verticais (`initNetwork`, `initFeatures`,
`initBenefits`, `initTail`) eram criadas **antes** dos pins da jornada.
Pins inserem pin-spacers e mudam a altura do documento — cerca de 300vw
convertidos em altura, no caso da jornada. As cenas criadas antes
calcularam `start/end` sobre um documento sem esses spacers, ficaram com
posições muito acima das reais e, sendo `once: true`, dispararam durante
o carregamento.

**Correção, em `boot()`:**

1. os pins são criados **primeiro**;
2. cada pin recebe `refreshPriority` decrescente na ordem da página
   (journey 3 → practice 2 → steps 1), para o refresh recalcular de
   cima para baixo;
3. só depois vêm as cenas verticais.

**Regra para quem mantiver:** crie ScrollTriggers na ordem em que as
seções aparecem na página, e pins sempre antes do que vem depois deles.
Há um comentário grande em `boot()` avisando disso — não reordene sem
lê-lo.

## Riscos

- **CDN do GSAP indisponível** — mitigado: a página degrada sozinha.
  *Como verificar:* bloqueie `cdnjs.cloudflare.com` no DevTools e recarregue;
  a landing deve funcionar idêntica à versão anterior.
- **Layout shift do Leaflet** — mitigado com 3 gatilhos de `refresh()`.
  Se surgirem triggers deslocados, o suspeito é sempre este.
- **Densidade dos painéis da jornada (RISCO PRINCIPAL)** — cada painel
  precisa caber em 100vh menos 96px de header e 76px de nav. O
  "Posicionamento" é o mais carregado: por isso vira duas colunas
  (discurso à esquerda, comparativo à direita) apenas dentro do painel.
  **Testar em 1366×768 antes de publicar.** Se estourar, os ajustes
  ficam concentrados no bloco §6 de `animations.css` (`.journey-panel`).
- **Jornada alonga muito a página** — 4 painéis = ~300vw de scroll
  traduzido em altura. Se ficar cansativo, reduza a folga final no
  `end` de `horizontalScene()`.
- **Custo do split de texto** — ~11 títulos divididos em palavras. Em
  frases longas use `splitWords`, nunca `splitChars`.
- **Botão magnético vs. timeline de entrada** — se o mouse passar sobre
  um botão durante a intro do hero, `x/y` são disputados por dois tweens.
  Efeito é cosmético e momentâneo.

## Como debugar

```js
// No console, com a página aberta:
ScrollTrigger.getAll().forEach(t => t.vars.markers = true);
ScrollTrigger.refresh();
```

Ou adicione `markers: true` na config de um ScrollTrigger específico em
`animations.js`. Para isolar uma cena, comente a chamada correspondente
dentro de `boot()` (§9).

## Melhorias futuras

1. Smooth scrolling com Lenis ou `ScrollSmoother` (plugin pago) para dar
   inércia ao conjunto.
2. Auto-hospedar o GSAP em `assets/vendor/` — elimina a dependência de CDN
   e permite `integrity`.
3. Substituir o `.hscroll-hint` textual por um indicador de progresso da
   faixa horizontal (bolinhas ou barra).
4. Teste automatizado de regressão visual (Playwright + screenshots em
   posições fixas de scroll) — hoje a validação é manual.
5. Contadores reais na seção Case, quando houver município parceiro com
   dados verificados.
