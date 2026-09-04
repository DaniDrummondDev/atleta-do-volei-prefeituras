# Sprint 01 — Revisão de copy, estrutura e posicionamento

## Objetivo

Aplicar as sugestões de `docs/Sugestões para Site de Prefeitura.md` (copy + estrutura) e o
posicionamento de produto de `docs/chat.md`, mantendo a paleta aprovada e trocando o texto
inferior do logo de azul para branco.

## Arquitetura da página (ordem final)

| # | Seção | Classe | Estado |
|---|-------|--------|--------|
| 1 | Hero | `.hero` | copy nova |
| 2 | O que a prefeitura ganha | `.statement#ganhos` | copy nova (3 cards) |
| 3 | O problema | `.problem` | **nova** — versão enxuta p/ mobile |
| 4 | A grande transformação | `.transform` | **nova** — Antes → Com Atleta do Vôlei |
| 4b | Posicionamento | `.position` | **nova** — vinda de `chat.md` |
| 5 | O diferencial | `.network#solucao` | mantida, textos dos círculos ampliados |
| 6 | Na prática | `.practice` | **nova** — 4 cards + bloco duplo prefeitura/atleta |
| 7 | Uma plataforma completa | `.features#como-funciona` | mantida, sobreposição corrigida |
| 8 | Benefícios | `.benefits` | copy nova (6 itens) + imagem placeholder |
| 9 | Como implementamos | `.steps` | 5 etapas |
| 10 | Case / prova | `.proof` | **nova** — sem métricas inventadas |
| 11 | FAQ | `.faq` | **nova** — `<details>` nativo, 7 perguntas |
| 12 | CTA final | `.cta#contato` | copy nova |

## Decisões técnicas

1. **Logo branco** — `assets/images/logo-white.svg` é gerado a partir de `logo.svg` recolorindo
   apenas os 19 paths do texto inferior (`#183F8E` → `#FFFFFF`). O ícone (que tem um círculo
   claro `#F1F2F3` de fundo) permanece intacto e continua legível sobre fundo escuro. Por isso
   o "pill" branco atrás do logo no rodapé (`.brand-footer { background:#fff }`) foi removido.
   *Para regerar:* recolorir os paths de índice 13 a 31 do SVG original.

2. **Sobreposição na seção "Plataforma completa"** — os mini-UIs (`.mini-ui`, `.bracket`,
   `.map-ui`, `.social-ui`) eram `position:absolute` e cobriam os parágrafos. Agora o
   `.feature-card` é `display:flex; flex-direction:column` e cada mini-UI usa
   `margin-top:auto` — o texto nunca é coberto, independente do comprimento.

3. **Case sem métricas** — os números aparecem como `—` com a nota "Números do primeiro
   município parceiro em breve". Há comentário HTML explícito proibindo números estimados.

4. **Posicionamento (`chat.md`)** — o site deixa de se vender como "sistema de gestão
   esportiva" (território do concorrente generalista) e passa a vender ecossistema 100% vôlei.
   Reflexos concretos: H1 "Transforme o vôlei da sua cidade", seção `.position` comparando
   *sistema generalista da Secretaria* × *Atleta do Vôlei*, bloco duplo
   prefeitura/atleta, argumento de gratuidade para o cidadão no hero, e duas perguntas de FAQ
   que derrubam a objeção "vamos ter que trocar de sistema?".
   A comparação é feita **por categoria**, nunca nomeando o concorrente.

5. **FAQ com `<details>`** — acessível e sem JavaScript adicional; `script.js` não mudou.

## Estrutura de pastas

```
index.html                                  # todas as seções, com comentários numerados
styles.css                                  # bloco "Seções adicionadas na revisão" no final
assets/images/logo-white.svg                # NOVO — texto inferior branco
assets/images/placeholder-beneficios.svg    # NOVO — trocar pela foto final
assets/images/placeholder-case.svg          # NOVO — trocar pela foto do município
```

## Onde mexer no futuro

- **Trocar as imagens finais:** substituir os dois `placeholder-*.svg`; os comentários
  `<!-- PLACEHOLDER: ... -->` no HTML marcam exatamente os pontos.
- **Ativar o case:** preencher `.proof-stats strong` e remover `.proof-note`.
- **Ajustar FAQ:** as perguntas ficam em `.faq-list`; validar a lista final com o Joel.
- **Rostos da "Equipe Municipal":** `assets/images/avatars/atleta-0{1..4}.svg` são retratos
  ilustrados provisórios. Para usar fotos reais, basta substituir os arquivos (o recorte
  circular e o tamanho são feitos por CSS em `.avatar-row img`, então qualquer proporção
  funciona). **Só publicar fotos de pessoas com autorização de uso de imagem.**

## Adendo — Mapa de quadras com OpenStreetMap

O card 03 deixou de ter um mapa desenhado em CSS e passou a exibir um mapa real
(OpenStreetMap via Leaflet 1.9.4, carregado por CDN com SRI).

- **`map.js`** é um arquivo próprio, com responsabilidade única. Centraliza o mapa na região
  de quem acessa (`navigator.geolocation`) e, se a permissão for negada, mantém o
  enquadramento padrão do Brasil sem exibir erro.
- **Integração futura com o banco:** `window.atletaMap.addCourts([{nome, lat, lng, nota}])`
  já plota marcadores, popups e reenquadra o mapa. Basta buscar os dados do Atleta do Vôlei
  e chamar essa função — nenhuma outra parte precisa mudar.
- **Layout:** `.map-canvas` usa `flex: 1` (mín. 215 px), então o mapa consome toda a sobra
  vertical do card — menos laranja no topo, mais mapa. O espaçamento entre o número do card
  e o ícone caiu de `35px` para `16px` na regra única `.feature-icon`, o que reduz o vazio
  nos **quatro** cards e preserva a simetria entre o laranja e o azul.
- `scrollWheelZoom` está desligado de propósito: o mapa vive dentro de uma landing page e o
  scroll da página tem prioridade. O zoom fica nos botões.
- **Atenção:** a geolocalização do navegador só funciona em **HTTPS** (ou `localhost`). Ao
  testar abrindo o arquivo direto (`file://`) o mapa aparece, mas não centraliza no visitante.

## Riscos

- **`assets/images/mockup_01.svg` tem 48,9 MB** e `mockup_02.svg` 16,2 MB. O mockup do hero
  ainda é carregado — isso trava o carregamento em 3G/4G, que é o cenário provável do
  secretário abrindo o link no celular. **Recomendação forte:** exportar como WebP/PNG
  otimizado (< 300 KB). `mockup_02.svg` já saiu do caminho crítico (substituído por placeholder).
- O logo branco depende do ícone ter fundo claro próprio; se a marca for atualizada sem esse
  círculo, o ícone somirá no header escuro.
- O FAQ traz respostas provisórias sobre **contratação e prazo** — precisam de validação
  comercial antes de publicar.

## Melhorias futuras

- Substituir mockups pesados por imagens rasterizadas otimizadas.
- Ligar o formulário a um endpoint real (hoje `script.js` só exibe mensagem local).
- `FAQPage` em JSON-LD para rich snippet no Google.
- Versão de 5 minutos do pitch (problema → diferença → benefício prefeitura → benefício
  atleta → custo/implantação) como material de apoio comercial.

## Como testar

Abrir `index.html` e conferir, em 375 px e 1440 px: nenhum texto coberto nos cards da seção
"Plataforma completa", os 4 círculos do diferencial legíveis, as 5 etapas quebrando em
coluna no mobile e o logo branco legível no header e no rodapé.
