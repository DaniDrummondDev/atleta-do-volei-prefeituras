# Vídeo do hero — roteiro de produção e integração

Status: vídeo fornecido em `assets/video/video.mp4` integrado ao hero. O arquivo
tem 6 segundos em 1920 × 1080. O tempo de reprodução acompanha o scroll,
inclusive ao voltar; não há autoplay. As artes dos banners não estão presentes
na filmagem fornecida. Não foram adicionadas sobreposições para simulá-las.

A imagem inicial foi editada em `assets/images/hero-office-orange.png`, mantendo
`hero-office.png` como original. Ferramenta: geração/edição de imagens integrada.
Prompt aplicado: preservar enquadramento, homem, escritório e iluminação;
alterar somente os cabeçalhos azuis das tabelas na tela para laranja #f39200 e
substituir o símbolo genérico pelo logo completo de `assets/images/logo.png`,
respeitando a perspectiva do monitor. Os pixels no zoom são da própria imagem,
desenhados em canvas sem interpolação; a antiga grade artificial foi removida.

Revisão com ícone: `assets/images/hero-office-icon.png`. Edição pela ferramenta
de imagens integrada, com `hero-office-orange.png` como base e `icon.png` como
referência. Prompt: substituir somente o logo horizontal e seu texto na tela
pelo ícone circular fornecido, restaurar o fundo claro onde havia texto e
preservar cabeçalhos laranja, planilhas, perspectiva, escritório e enquadramento.

Revisão atual em uso: `assets/images/hero-office-icon-small.png`, editada pela
mesma ferramenta integrada. Prompt: reduzir apenas o ícone para cerca de 60%
do tamanho anterior e movê-lo para a direita, abaixo do cabeçalho laranja,
mantendo margem da borda do monitor e preservando o restante da fotografia.

O roteiro abaixo é a referência de produção original. O vídeo recebido foi
preservado; a passagem ao mockup no encerramento é um fade, pois a filmagem
termina com o homem abaixando o aparelho.

Validação da integração: Chrome, desktop 1440 × 900 e mobile 390 × 844.
Verificados avanço e retrocesso pelo scroll, pausa sem rolagem, texto e mockup
visíveis no final, liberação do pin, redimensionamento e movimento reduzido.
Em HTTP, o MP4 é carregado como Blob antes das buscas de quadros, permitindo
controle também em servidores estáticos sem suporte a requisições HTTP por
intervalo. Ao abrir o HTML por `file://`, o vídeo usa `src` diretamente:
`fetch(file://)` é bloqueado pelo navegador. Esse modo também foi validado
com avanço, pausa, retrocesso, encerramento e layout mobile. Durante o
carregamento da mídia, a primeira cena (escritório) permanece visível.

## Formato e referências

- Proporção: 16:9. Resolução explicitamente solicitada: 1920 × 1080 (Full HD).
  Um master 4K, caso produzido, tem 3840 × 2160.
- Duração sugerida: 16 segundos, 30 fps, sem áudio; a reprodução acompanha o
  scroll, portanto a duração não obriga o visitante a esperar 16 segundos.
- Referência do celular e da interface: `assets/images/mockup_01.png`.
- Marca: `assets/images/logo.png`.
- Arte do banner do campeonato: reproduzir a arte azul do topo da tela do
  mockup, com letras amarelas “TORNEIO DA PRAINHA”, bola e mãos de vôlei,
  faixa branca “Vôlei de praia”. Não substituir por um banner azul genérico.
- Preservar a quadra oficial com arquibancada pedida no roteiro, mesmo que
  a arte de referência do torneio mencione vôlei de praia.

## Sequência para produção

1. **0–3 s — escritório.** Filmagem ultrarrealista de um escritório com mesas,
   cadeiras e computadores. Homem em primeiro plano trabalhando. O monitor
   mostra uma planilha de organização de campeonato de vôlei. Movimento
   natural de mãos e corpo, iluminação realista.
2. **3–5 s — aproximação.** A câmera aproxima-se da tela até distinguir os
   pixels do próprio conteúdo exibido. As cores e formas ampliadas continuam
   pertencendo à planilha. Não inserir tela azul, grade branca ou transição
   gráfica independente. Fazer a passagem visual entre os pixels do monitor
   e os da tela do celular durante essa aproximação extrema.
3. **5–9 s — afastamento.** A câmera afasta-se da tela do celular e revela o
   aparelho de verdade na mão de um homem visto de costas até a cintura,
   posicionado no local do árbitro. Manter contato dos dedos com o aparelho,
   perspectiva, sombras e oclusões corretas durante todo o movimento. A tela
   usa a interface de referência. Revelar a quadra de vôlei bem iluminada,
   com arquibancada ao fundo. Na parede atrás dela, dois banners físicos:
   arte do Torneio da Prainha e marca Atleta do Vôlei. Ambos acompanham a
   perspectiva e iluminação da parede; não podem flutuar sobre a filmagem.
4. **9–13 s — jogada.** Mostrar movimento contínuo: o levantador toca a bola
   com as duas mãos, a bola percorre um arco até o atacante, o atacante
   salta e corta, e a bola cruza a rede. Preservar continuidade temporal,
   anatomia e uma única bola. Não simular a jogada com zoom de uma foto.
5. **13–16 s — encerramento.** A cena da quadra e o homem desaparecem em
   fade-out. Durante a transição, substituir o aparelho filmado pelo
   `mockup_01.png`, alinhando posição, escala e orientação para evitar salto
   ou duplicação. O mockup assume posição à direita sobre fundo azul-escuro.
   À esquerda, revelar sequencialmente as três linhas:

   - “Transforme o” — branco;
   - “vôlei da sua” — “vôlei” branco e “da sua” coral;
   - “cidade.” — coral.

   Tipografia pesada e espaçamento conforme a referência enviada. A frase
   pode ser renderizada em HTML para preservar nitidez e texto exato.

## Integração após receber o vídeo

- Substituir os fundos estáticos e remover `.hero-film-pixels` e
  `.hero-film-banners`. O mockup separado só aparece no encerramento.
- Vincular o tempo do vídeo ao progresso do ScrollTrigger, nos dois sentidos,
  depois de carregar os metadados. Não usar reprodução automática independente
  do scroll. Preparar MP4 com índice no início e keyframes frequentes para
  permitir busca de quadros com boa resposta.
- Fixar o hero durante a sequência; liberar ao concluir. Criar seu pin antes
  dos pins seguintes, preservando os cálculos de posição do restante da página.
- Preservar os mecanismos de rolagem do restante do site. O snap vertical
  não deve interromper a sequência enquanto o hero estiver pinado.
- Oferecer composição final estática em preferência por movimento reduzido
  ou falha no carregamento. Garantir título legível nesses modos.
- Verificar no navegador o início, a transição entre telas, a jogada, a troca
  pelo mockup, o final, o scroll reverso, o redimensionamento e a passagem
  do hero para a jornada. Validar perspectiva dos banners e contato da mão
  com o celular na filmagem antes da integração.
