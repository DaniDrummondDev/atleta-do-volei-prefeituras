# Sprint — Correção da transição Hero → "O que a prefeitura ganha?" no mobile

## Objetivo

No mobile, ao terminar a cena cinematográfica do hero, a seção deveria **subir com
a rolagem** (como no desktop). Em vez disso ela ficava travada na tela e a
`.journey` (section "O que a prefeitura ganha?") passava por cima dela.

## Arquitetura do trecho afetado

```
<main>
  <section class="hero hero-film-section">   ← ScrollTrigger id "hero-film", pin: true
  <div class="journey hscroll-viewport">     ← position: relative (animations.css §5)
      <section class="statement journey-panel"> "O que a prefeitura ganha?"
```

Durante o pin, o ScrollTrigger envolve o hero num `.pin-spacer` e o coloca em
`position: fixed`. O spacer reserva `end - start` de altura, e ao passar do `end`
o hero volta a `position: relative` no fim do spacer — é isso que produz a
sensação de "subir".

## Causa raiz (duas, somadas)

**1. O `end` do pin era um alvo móvel no mobile.**
`end: '+=' + window.innerHeight * 5` com `invalidateOnRefresh: true`. No mobile,
esconder/mostrar a barra de URL dispara `resize` → `ScrollTrigger.refresh()` →
`end` recalculado com um `innerHeight` ~90px maior → o ponto de unpin desce
~450px **durante a própria rolagem**. O hero nunca alcançava a soltura.
No desktop `innerHeight` é constante, por isso o bug não aparecia lá.

**2. O hero pinado não tinha camada de empilhamento própria.**
`position: fixed` + `z-index: auto`. A `.journey` vem depois no DOM e é
`position: relative` → é pintada por cima. É exatamente o problema que o próprio
código já havia diagnosticado e resolvido para `.practice .hscroll-viewport`
(animations.css §5, linhas 152-158) — o hero ficou de fora daquela correção.

**3. (agravante) `html { scroll-behavior: smooth }`** briga com o ScrollTrigger:
o navegador segue animando a posição por conta própria enquanto os pins leem
`scrollY`.

## Decisões técnicas

| # | Mudança | Arquivo | Por quê |
|---|---------|---------|---------|
| 1 | `ScrollTrigger.config({ ignoreMobileResize: true })` | animations.js §1 | Ignora resize só-de-altura em telas de toque. Giro de tela (muda largura) segue refreshando. |
| 2 | `end` passa a usar `hero.offsetHeight` | animations.js §4 | O hero é `100svh !important` no mobile — valor **estático**, não muda com a barra de URL. No desktop é 100vh, portanto comportamento idêntico ao anterior. |
| 3 | `onToggle` aplica/retira `.is-pinned` + `z-index: 4` | animations.js §4 + styles.css | Camada própria **apenas enquanto pinado**. Ao soltar, volta a `auto` e a `.journey` cobre o hero normalmente. Fica abaixo do `.site-header` (z-index 20). |
| 4 | `html.gsap-ready { scroll-behavior: auto }` | styles.css | Sem GSAP o suave nativo permanece; com GSAP quem faz âncora suave é o ScrollToPlugin (`initAnchors`). |
| 5 | Guarda de dimensão em `resizeOffice()` | animations.js §4 | Reatribuir `canvas.width/height` limpa o buffer. O `resize` da barra de URL chegava dezenas de vezes por rolagem, piscando a cena. Agora só realoca quando a dimensão muda de fato — mas **sempre** redesenha (o `mediaReady` depende disso). |

## Rodada 2 — evidência de `docs/bug.mp4`

A rodada 1 não bastou. A gravação (iPhone / Safari, 460x878, 8,5s) mostra a
causa que faltava, visível já no primeiro quadro:

- A cena do hero **não cobre a tela**. Ocupa ~72% da altura e sobra uma
  **faixa creme** embaixo. Nessa faixa aparece e rola a seção
  "O que a prefeitura ganha?" — daí a leitura de "o hero fica parado e a
  section passa por cima".
- O `mouse.gif` (`.hero-film-scroll`) fica na tela do começo ao fim do filme,
  como um borrão escuro sobre a cena.

### Causa: `100svh` é a menor altura possível da viewport

O bloco `@media (max-width: 900px)` forçava `height: 100svh !important` no
palco. No iOS Safari:

| unidade | significado | muda ao rolar? |
|---------|-------------|----------------|
| `svh`   | barras TODAS visíveis (**menor**) | não |
| `lvh`   | barras recolhidas (**maior**)     | não |
| `dvh`   | estado atual                      | **sim** |

Durante a rolagem o Safari recolhe as barras e a viewport real vira ~`lvh`.
Um palco de `svh` em `position: fixed` (que é o que o pin faz) cobre então só
~85% da tela — e os ~15% restantes expõem a seção seguinte.

`dvh` não serve: mudaria a altura do elemento fixo no meio da cena. A escolha
correta para hero full-bleed é **`lvh`**: estático e o maior. Com as barras
abertas sobra altura, mas o excesso fica atrás da toolbar — invisível.

### Mudanças da rodada 2

| # | Mudança | Arquivo |
|---|---------|---------|
| 6 | Palco (`.hero-film-section` e `.hero-film`): `100svh` → `100lvh`, com `100vh` antes como fallback | styles.css `@media 900px` |
| 7 | Elementos internos (copy, mockup, indicador de scroll) ancorados em `svh`, não em `%` do palco — assim seguem dentro da área sempre visível em vez de escorregarem para trás da toolbar | styles.css `@media 900px` e `@media 600px` |
| 8 | `.hero-film-scroll` sai por `autoAlpha` no início da timeline | animations.js §4 |

## Rodada 3 — diagrama da rede ("O Grande Diferencial") no mobile

**Sintoma:** os quatro nós (EVENTOS / ATLETAS / QUADRAS / EQUIPES) se
sobrepõem entre si e sobre o núcleo coral; os anéis pontilhados vazam da tela.

**Causa:** não havia *nenhuma* regra mobile para o diagrama. Todas as medidas
são px absolutos desenhados para a coluna de ~538px do grid de duas colunas do
desktop — anel externo de 510px, nós de 152px, posições como `left: 193px`.
Abaixo de 900px o grid vira uma coluna de ~350px e nada é recalculado.

**Correção:** um bloco `@media (max-width: 900px)` que reexpressa o desenho em
**porcentagem de um palco quadrado** (`width: min(100%, 380px); aspect-ratio: 1`).
Como todo diâmetro e toda posição passam a ser relativos ao lado do quadrado,
o diagrama escala inteiro e mantém as proporções do desktop.

Geometria (S = lado do quadrado):

| elemento | desktop | mobile (% de S) |
|---|---|---|
| nó (diâmetro) | 152px | 30% |
| raio da órbita | 208px | 35% |
| anel A / B / C | 510 / 350 / 210px | 90% / 61% / 37% |
| núcleo | 145px | 29% |

`R + d/2 = 35% + 15% = 50%` → os nós tangenciam exatamente a borda, nenhum é
cortado. A folga entre nós vizinhos é `R·√2 − d ≈ 19%` de S.

**Decisão de conteúdo:** `.node small` (a descrição de 3 linhas dentro do
círculo) fica `display: none` no mobile. Num nó de ~105px ela transbordava.
Ícone + rótulo sustentam a leitura, e o detalhe já está no texto ao lado.
Alternativa, se a descrição for obrigatória: nós maiores + órbita maior, o que
exige o palco ocupando mais que a largura do `.container`.

**Armadilha registrada no CSS:** `.node` não pode receber `transform` por CSS —
`initNetwork` escreve `transform: rotate()` nele e no wrapper `.node-orbit`
para manter o texto na horizontal. As posições usam só `top`/`left`.

## Riscos

- **Não foi possível validar em navegador real.** O Chromium do Playwright neste
  ambiente falha por falta de `libnspr4.so` e não há sudo para instalar as libs.
  A análise é estática, apoiada nos comentários que o próprio código já traz
  sobre o mesmo padrão de bug em `.practice`. **Teste manual no celular é
  obrigatório antes do deploy.**
- `ignoreMobileResize` é global: se alguma cena futura precisar reagir a mudança
  de altura no mobile, ela não vai receber o refresh. Nesse caso, chamar
  `ScrollTrigger.refresh()` explicitamente no ponto certo.
- `z-index: 4` no hero pinado: se algum overlay futuro precisar ficar acima do
  hero durante a cena, precisa de z-index > 4 (o header já tem 20).

## Como testar

1. `python3 -m http.server 8123` na raiz e abrir no celular (mesma rede) ou no
   DevTools em modo dispositivo com **throttling de barra de URL** (device real
   é mais fiel — o emulador não reproduz o resize da barra).
2. Rolar o hero até o fim da cena (celular + copy final).
3. **Esperado:** o hero sobe junto com a rolagem e a `.statement` entra por
   baixo dele, sem sobreposição.
4. Rolar para cima e para baixo repetidamente no ponto de transição — não pode
   haver salto nem "grude".
5. Girar a tela no meio da cena: o layout deve se recompor (refresh de largura).

## Melhorias futuras

- A cena consome **5 alturas de viewport** de rolagem. No mobile isso são ~5
  gestos completos antes de chegar ao conteúdo. Vale medir/reduzir para ~3.
- Trocar o bloco de `!important` de `100svh` (styles.css, `@media max-width:900px`)
  por `height: 100svh` sem `!important` assim que se confirmar que o
  ScrollTrigger não precisa mais sobrescrever a altura inline — o `!important`
  hoje vence os estilos inline do pin, o que é frágil.
- Adicionar um teste de fumaça com Playwright (quando as libs do sistema
  estiverem instaladas) que verifique `getComputedStyle(hero).position === 'relative'`
  logo após o `end` do trigger.
