/* ===================================================================
   animations.js — camada de movimento da landing page
   GSAP 3 + ScrollTrigger + ScrollToPlugin

   RESPONSABILIDADE
   Toda a orquestração de animação da página. Não contém regra de
   negócio: menu, FAQ e formulário continuam em script.js.

   CONTRATO COM O RESTO DO SITE
   - Se GSAP não carregar (CDN fora) ou o usuário pedir
     `prefers-reduced-motion`, este arquivo remove a classe
     `gsap-ready` do <html> e sai sem fazer nada. A página volta ao
     comportamento original (.reveal + IntersectionObserver).
   - script.js verifica `gsap-ready` antes de ligar o IntersectionObserver,
     para as duas camadas nunca animarem o mesmo elemento.

   MAPA DO ARQUIVO
     §1   Guarda de ativação
     §2   Helpers (split de texto, seletores, onEnter)
     §2b  SCROLL LOCK — trava o scroll, roda a cena, destrava
     §3   Chrome: barra de progresso, header, âncoras
     §4   Hero
     §5   Cenas verticais (rede, plataforma, benefícios, FAQ/CTA)
     §6   A jornada: 4 painéis horizontais pinados
     §7   Cenas pinadas horizontais: Na prática / Como implementamos
     §8   Microinterações (botão magnético, tilt)
     §9   Boot — A ORDEM DE CRIAÇÃO IMPORTA, leia o comentário lá

   ONDE MEXER
     - Ritmo/duração global ............. const EASE / DUR
     - Quais seções travam o scroll ..... const LOCKED_SECTIONS (§2b)
     - Ligar/desligar uma cena .......... comente a chamada em boot()
     - Breakpoint do horizontal ......... const DESKTOP
   =================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  /* -----------------------------------------------------------------
     §1 GUARDA DE ATIVAÇÃO
     O <head> aplica `gsap-ready` de forma otimista para evitar flash
     de layout. Aqui confirmamos ou revertemos.
     ----------------------------------------------------------------- */
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  if (!hasGsap || prefersReduced) {
    root.classList.remove('gsap-ready');
    return; // script.js assume com o IntersectionObserver.
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin);

  // Sinaliza para script.js que o observer legado não deve rodar.
  window.__gsapEnhanced = true;

  var EASE = 'power3.out';
  var DUR = 0.9;
  var DESKTOP = '(min-width: 901px)';

  /* -----------------------------------------------------------------
     §2 HELPERS
     ----------------------------------------------------------------- */

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /**
   * Envolve cada palavra de um elemento em duas camadas:
   *   <span class="split-word"><span class="split-word-inner">palavra</span></span>
   * A externa é a janela (overflow), a interna é o que desliza.
   *
   * Percorre a árvore recursivamente para PRESERVAR elementos internos
   * (<em>, <span>, <br>) — o h1 do hero e vários h2 dependem disso.
   * Idempotente: marca o elemento com data-split.
   *
   * @returns {HTMLElement[]} os .split-word-inner, na ordem do texto.
   */
  function splitWords(el) {
    if (!el || el.dataset.split === 'words') return $$('.split-word-inner', el);
    el.dataset.split = 'words';

    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) { // nó de texto
          var parts = child.nodeValue.split(/(\s+)/);
          if (!child.nodeValue.trim()) return;
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            var outer = document.createElement('span');
            outer.className = 'split-word';
            var inner = document.createElement('span');
            inner.className = 'split-word-inner';
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };

    walk(el);
    return $$('.split-word-inner', el);
  }

  /**
   * Quebra em caracteres. Usado só em frases curtas — um char por span
   * fica caro em texto longo. Não recursivo: espera texto simples.
   */
  function splitChars(el) {
    if (!el || el.dataset.split === 'chars') return $$('.split-char', el);
    var text = el.textContent;
    el.textContent = '';
    text.split('').forEach(function (ch) {
      var span = document.createElement('span');
      span.className = 'split-char';
      span.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(span);
    });
    el.dataset.split = 'chars';
    return $$('.split-char', el);
  }

  /**
   * Config de ScrollTrigger para "entrar em cena".
   *
   * @param trigger   elemento (ou seletor) observado
   * @param extra     overrides. `start` vale no modo vertical,
   *                  `startH` no modo horizontal.
   * @param container timeline do scroll horizontal. Quando presente, o
   *                  trigger passa a medir a posição HORIZONTAL do
   *                  elemento dentro do track — é isso que permite
   *                  animar conteúdo que vive dentro de um pin
   *                  horizontal. Sem ele, comportamento vertical normal.
   */
  function onEnter(trigger, extra, container) {
    var cfg = container
      ? { trigger: trigger, containerAnimation: container, start: 'left 80%', once: true }
      : { trigger: trigger, start: 'top 82%', once: true };

    if (extra) Object.keys(extra).forEach(function (k) {
      if (k === 'start') { if (!container) cfg.start = extra[k]; return; }
      if (k === 'startH') { if (container) cfg.start = extra[k]; return; }
      cfg[k] = extra[k];
    });
    return cfg;
  }

  /* -----------------------------------------------------------------
     §2b SCROLL LOCK — "para o scroll, anima, libera"

     Ao chegar numa seção marcada, a página alinha a seção, TRAVA o
     scroll, roda a sequência de animação e destrava. Acontece uma única
     vez por seção.

     ATENÇÃO AO MEXER AQUI: tirar o controle do scroll do usuário é
     agressivo. Por isso o lock tem quatro saídas de emergência, e
     nenhuma delas deve ser removida:
       1. um failsafe por tempo (duração da cena + folga, teto
          `HARD_CAP`) destrava à força, aconteça o que acontecer;
       2. Esc destrava na hora;
       3. duas tentativas de rolar (wheel/touch) destravam — se a pessoa
          insiste, ela ganha;
       4. `once`: nunca trava a mesma seção duas vezes, então voltar
          pelo mesmo caminho não re-prende ninguém.

     Para ligar/desligar por seção, edite LOCKED_SECTIONS em §9.
     ----------------------------------------------------------------- */

  /**
   * Seções que travam o scroll ao serem alcançadas.
   * ESTA É A LISTA PARA EDITAR se quiser ligar/desligar o efeito por
   * seção. As seções pinadas (.journey, .practice, .steps) não entram
   * aqui: elas já seguram a tela por natureza.
   */
  var LOCKED_SECTIONS = ['.network', '.features', '.benefits'];

  var HARD_CAP = 5;          // segundos: nenhum lock passa disto, nunca
  var ESCAPE_ATTEMPTS = 2;   // gestos de scroll que cancelam o lock

  /** true se o elemento está dentro de alguma seção com lock. */
  function inLockedSection(el) {
    return LOCKED_SECTIONS.some(function (sel) { return !!el.closest(sel); });
  }

  var lockState = { active: false, attempts: 0, release: null };

  function blockEvent(e) {
    // Conta a insistência do usuário: na 2ª tentativa, devolve o scroll.
    lockState.attempts += 1;
    if (lockState.attempts > ESCAPE_ATTEMPTS) {
      if (lockState.release) lockState.release();
      return;
    }
    e.preventDefault();
  }

  function blockKeys(e) {
    if (e.key === 'Escape') {
      if (lockState.release) lockState.release();
      return;
    }
    var keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];
    if (keys.indexOf(e.key) !== -1) e.preventDefault();
  }

  function lockScroll() {
    if (lockState.active) return;
    lockState.active = true;
    lockState.attempts = 0;
    window.addEventListener('wheel', blockEvent, { passive: false });
    window.addEventListener('touchmove', blockEvent, { passive: false });
    window.addEventListener('keydown', blockKeys, { passive: false });
  }

  function unlockScroll() {
    if (!lockState.active) return;
    lockState.active = false;
    lockState.release = null;
    window.removeEventListener('wheel', blockEvent, { passive: false });
    window.removeEventListener('touchmove', blockEvent, { passive: false });
    window.removeEventListener('keydown', blockKeys, { passive: false });
  }

  /**
   * Roda uma sequência com o scroll travado.
   *
   * @param {string}   selector  seção a observar
   * @param {Function} buildTl   recebe a seção, devolve uma timeline
   *                             PAUSADA com a sequência da seção
   */
  function lockedScene(selector, buildTl) {
    var section = $(selector);
    if (!section) return;

    var tl = buildTl(section);
    if (!tl) return;
    tl.pause();

    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      once: true,
      onEnter: function () {
        var failsafe;

        var release = function () {
          if (failsafe) failsafe.kill();
          unlockScroll();
          // Se a pessoa cancelou no meio, a cena termina de uma vez —
          // ninguém fica com meia animação na tela.
          if (tl.progress() < 1) tl.progress(1);
        };

        lockState.release = release;
        lockLoop();

        function lockLoop() {
          lockScroll();
          // O teto acompanha a duração real da cena (+ o alinhamento e
          // uma folga), mas nunca passa de HARD_CAP. Um teto fixo curto
          // cortaria as cenas longas sempre no mesmo ponto.
          failsafe = gsap.delayedCall(Math.min(tl.duration() + 1.2, HARD_CAP), release);

          // 1) alinha a seção  2) roda a cena  3) destrava
          var align = window.ScrollToPlugin
            ? gsap.to(window, {
              duration: 0.45,
              ease: 'power2.inOut',
              scrollTo: { y: section, offsetY: 70, autoKill: false }
            })
            : null;

          var start = function () {
            tl.eventCallback('onComplete', release);
            tl.play(0);
          };

          if (align) align.eventCallback('onComplete', start);
          else start();
        }
      }
    });
  }

  /* -----------------------------------------------------------------
     §3 CHROME DA PÁGINA
     ----------------------------------------------------------------- */

  /** Barra de leitura no topo, ligada ao progresso total do documento. */
  function initProgressBar() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    gsap.to(bar, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
    });
  }

  /**
   * Header fixo com auto-hide.
   * - `is-stuck`  : passou do hero → fundo translúcido + altura menor.
   * - `is-hidden` : usuário descendo → sai de cena. Volta ao subir.
   * Nunca esconde com o menu mobile aberto.
   */
  function initHeader() {
    var header = $('.site-header');
    var nav = $('.main-nav');
    if (!header) return;

    ScrollTrigger.create({
      start: 'top -120',
      end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        header.classList.toggle('is-stuck', y > 120);

        var menuOpen = nav && nav.classList.contains('open');
        var hide = self.direction === 1 && y > 320 && !menuOpen;
        header.classList.toggle('is-hidden', hide);
      }
    });
  }

  /**
   * Navegação por âncora via ScrollToPlugin.
   * Necessário porque desligamos `scroll-behavior: smooth` (§1 do CSS)
   * e porque o scroll nativo erra o alvo quando há seções pinadas —
   * ScrollTrigger.refresh() recalcula os offsets antes do salto.
   */
  function initAnchors() {
    if (!window.ScrollToPlugin) return;
    var headerH = 82;

    $$('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;

        e.preventDefault();
        gsap.to(window, {
          duration: 1.1,
          ease: 'power2.inOut',
          scrollTo: { y: target, offsetY: headerH, autoKill: true }
        });
      });
    });
  }

  /* -----------------------------------------------------------------
     §4 HERO — sequência cinematográfica controlada pelo scroll
     ----------------------------------------------------------------- */
  function initHero() {
    var hero = $('.hero');
    var film = $('.hero-film', hero);
    if (!hero || !film) return;

    var office = $('.hero-film-office', film);
    var zoom = $('.hero-film-zoom', film);
    var context = zoom.getContext('2d');
    var court = $('.hero-film-court', film);
    var phone = $('.hero-film-phone', film);
    var outro = $('.hero-film-outro', film);
    var copy = $$('.hero-film-copy span', film);
    var scrollHint = $('.hero-film-scroll', hero);

    if (!context) return;
    var camera = { scale: 1 };
    var playback = { progress: 0 };
    var failed = false;
    var tl;

    // Amplia o recorte da própria fotografia, sem desenhar uma grade.
    // Sem interpolação, os pixels originais ficam visíveis no close extremo.
    function drawOffice() {
      if (!office.naturalWidth) return;
      var cover = Math.max(zoom.width / office.naturalWidth, zoom.height / office.naturalHeight);
      var width = zoom.width / cover / camera.scale;
      var height = zoom.height / cover / camera.scale;
      var travel = 1 - 1 / camera.scale;
      var centerX = office.naturalWidth * (0.5 + 0.14 * travel);
      var centerY = office.naturalHeight * (0.5 - 0.06 * travel);
      var left = Math.max(0, Math.min(office.naturalWidth - width, centerX - width / 2));
      var top = Math.max(0, Math.min(office.naturalHeight - height, centerY - height / 2));
      context.imageSmoothingEnabled = false;
      context.drawImage(office, left, top, width, height, 0, 0, zoom.width, zoom.height);
    }

    function resizeOffice() {
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      zoom.width = Math.round(film.clientWidth * ratio);
      zoom.height = Math.round(film.clientHeight * ratio);
      drawOffice();
    }

    // Nunca usa play(): o tempo vem exclusivamente do progresso do scroll.
    // Uma busca por vez evita cancelar continuamente a decodificação.
    function seekVideo() {
      if (failed || court.readyState < 2 || court.seeking || !Number.isFinite(court.duration)) return;
      var target = playback.progress * Math.max(0, court.duration - 0.04);
      if (Math.abs(court.currentTime - target) > 0.025) court.currentTime = target;
    }

    function mediaReady() {
      if (failed || !office.naturalWidth || court.readyState < 2) return;
      resizeOffice();
      hero.classList.add('hero-film-ready');
      seekVideo();
    }

    function mediaFailed() {
      failed = true;
      hero.classList.remove('hero-film-ready');
      court.pause();
      if (tl) {
        tl.scrollTrigger.kill();
        tl.kill();
        ScrollTrigger.refresh();
      }
    }

    court.muted = true;
    court.pause();
    court.addEventListener('seeked', seekVideo);
    court.addEventListener('loadeddata', mediaReady);
    court.addEventListener('error', mediaFailed);
    office.addEventListener('load', mediaReady);
    office.addEventListener('error', mediaFailed);
    window.addEventListener('resize', resizeOffice);

    gsap.set([court, phone, outro], { autoAlpha: 0 });
    gsap.set(zoom, { autoAlpha: 1 });
    gsap.set(copy, { autoAlpha: 0, yPercent: 112 });

    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'hero-film',
        trigger: hero,
        start: 'top top',
        end: function () { return '+=' + window.innerHeight * 5; },
        pin: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        refreshPriority: 4
      }
    });
    tl
      // Escritório → pixels reais da tela → abertura para a filmagem.
      .to(camera, { scale: 1, duration: 0.3 })
      .to(camera, { scale: 160, duration: 1.2, ease: 'power3.in', onUpdate: drawOffice })
      .to(scrollHint, { autoAlpha: 0, duration: 0.18 }, 0.32)
      .fromTo(court, { scale: 24 }, { autoAlpha: 1, scale: 1, duration: 0.65, ease: 'power2.out' }, 1.5)
      .to(zoom, { autoAlpha: 0, duration: 0.3 }, 1.5)
      .to(office, { autoAlpha: 0, duration: 0.3 }, 1.5)
      // Banners, mãos e atletas pertencem ao vídeo fornecido.
      .to(playback, { progress: 1, duration: 3.4, onUpdate: seekVideo }, 2.15)
      .to(outro, { autoAlpha: 1, duration: 0.5 }, 5.55)
      .to(court, { autoAlpha: 0, duration: 0.5 }, 5.55)
      .fromTo(phone, { scale: 0.82 }, { autoAlpha: 1, scale: 1, duration: 0.65 }, 5.7)
      .to(copy, { autoAlpha: 1, yPercent: 0, stagger: 0.19, duration: 0.46 }, 6.05)
      .to({}, { duration: 0.35 });

    mediaReady();
    if (court.error || (office.complete && !office.naturalWidth)) mediaFailed();

    // Arquivos locais não permitem fetch(file://), mas <video src> pode
    // carregá-los normalmente. Também serve de alternativa ao fetch HTTP.
    function loadVideoDirectly() {
      if (failed) return;
      court.src = court.dataset.src;
      court.load();
    }

    if (window.location.protocol === 'file:') {
      loadVideoDirectly();
      return;
    }

    // Em HTTP, carregar os ~5 MB completos permite buscar qualquer quadro
    // mesmo quando o servidor não oferece requisições por intervalo.
    fetch(court.dataset.src)
      .then(function (response) {
        if (!response.ok) throw new Error('Falha ao carregar o vídeo do hero');
        return response.blob();
      })
      .then(function (blob) {
        if (failed) return;
        court.src = URL.createObjectURL(blob);
        court.load();
      })
      .catch(loadVideoDirectly);
  }

  /* -----------------------------------------------------------------
     §5 CENAS VERTICAIS
     ----------------------------------------------------------------- */

  /**
   * Título com máscara: cada palavra sobe de dentro da própria janela.
   * @param container timeline horizontal, se o título estiver num painel.
   */
  function headingReveal(selector, container) {
    $$(selector).forEach(function (h) {
      var words = splitWords(h);
      gsap.from(words, {
        yPercent: 115,
        stagger: 0.04,
        duration: 0.95,
        ease: EASE,
        scrollTrigger: onEnter(h, { startH: 'left 78%' }, container)
      });
    });
  }

  /** Eyebrow (rótulo pequeno acima do título). */
  function eyebrowReveal(el, container) {
    gsap.from(el, {
      opacity: 0,
      y: 14,
      duration: 0.6,
      ease: EASE,
      scrollTrigger: onEnter(el, { start: 'top 92%', startH: 'left 85%' }, container)
    });
  }

  /** PAINEL 1 — O QUE A PREFEITURA GANHA: cards em stagger 3D. */
  function initStats(container) {
    var grid = $('.statement .stats-grid');
    if (!grid) return;

    gsap.from($$('.stat-card', grid), {
      y: 70,
      opacity: 0,
      rotateX: -14,
      transformOrigin: '50% 100%',
      stagger: 0.13,
      duration: 1,
      ease: EASE,
      scrollTrigger: onEnter(grid, { startH: 'left 72%' }, container)
    });

    gsap.from($$('.stat-card .stat-icon'), {
      scale: 0,
      rotate: -45,
      stagger: 0.13,
      duration: 0.6,
      ease: 'back.out(2)',
      scrollTrigger: onEnter(grid, { start: 'top 78%', startH: 'left 65%' }, container)
    });

    // Parallax do card central: só no modo vertical. Dentro do track
    // horizontal um segundo tween em `y` brigaria com o layout do painel.
    if (!container) {
      gsap.to($('.stat-card.featured', grid), {
        y: -34,
        ease: 'none',
        scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
      });
    }
  }

  /** PAINEL 2 — O DESAFIO: lista por clip-path, fecho digitado. */
  function initProblem(container) {
    var section = $('.problem');
    if (!section) return;

    gsap.from($$('.problem-list li', section), {
      clipPath: 'inset(0 100% 0 0)',
      x: -18,
      opacity: 0,
      stagger: 0.11,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: onEnter($('.problem-list', section), { startH: 'left 72%' }, container)
    });

    var close = $('.problem-close strong', section);
    if (close) {
      gsap.from(splitChars(close), {
        opacity: 0,
        y: 12,
        stagger: 0.018,
        duration: 0.5,
        ease: 'power2.out',
        scrollTrigger: onEnter(close, { start: 'top 88%', startH: 'left 60%' }, container)
      });
    }
  }

  /**
   * PAINEL 3 — A GRANDE TRANSFORMAÇÃO.
   *
   * Cena controlada por scrub: o usuário "dirige" a sequência com o
   * próprio scroll. Ordem:
   *   1. card ANTES entra e seus itens caem um a um
   *   2. a seta gira e cresce
   *   3. o card COM ATLETA DO VÔLEI entra pela direita
   *
   * O card ANTES PERMANECE em cena até o fim — é o contraste que dá
   * sentido ao "depois". Nada nesta timeline reduz sua opacidade.
   */
  function initTransformPanel(container) {
    var panel = $('.transform');
    if (!panel) return;

    var before = $('.transform-before', panel);
    var arrow = $('.transform-arrow', panel);
    var after = $('.transform-after', panel);
    if (!before || !after) return;

    var st = container
      ? { trigger: panel, containerAnimation: container, start: 'left 72%', end: 'left -20%', scrub: 0.6 }
      : { trigger: panel, start: 'top 72%', end: 'bottom 55%', scrub: 0.6 };

    gsap.timeline({ scrollTrigger: st })
      .from(before, { x: -60, opacity: 0, duration: 0.7, ease: EASE })
      .from($$('li', before), { x: -34, opacity: 0, stagger: 0.16, duration: 0.5, ease: 'power2.out' }, '-=0.3')
      .fromTo(arrow,
        { rotate: -200, scale: 0, opacity: 0 },
        { rotate: 0, scale: 1.55, opacity: 1, duration: 0.75, ease: 'back.out(1.6)' }, '+=0.15')
      .from(after, { x: 90, opacity: 0, duration: 0.85, ease: EASE }, '-=0.25')
      .to(arrow, { scale: 1, duration: 0.45, ease: 'power2.out' }, '-=0.5')
      // Realce final no card novo — o ANTES continua visível ao lado.
      .fromTo(after,
        { boxShadow: '0 0 0 0 rgba(255,104,77,0)' },
        { boxShadow: '0 22px 60px 0 rgba(8,47,102,0.35)', duration: 0.5 }, '-=0.3');
  }

  /**
   * PAINEL 4 — POSICIONAMENTO.
   * Texto e listas animados: título mascarado, lead por palavras,
   * colunas entrando de lados opostos e cada item das duas listas
   * revelado em cascata (a coluna destacada com um leve atraso, para
   * o olho ler primeiro o "sistema generalista" e depois o contraste).
   */
  function initPosition(container) {
    var section = $('.position');
    var grid = $('.position-grid', section || document);
    if (!section || !grid) return;

    var lead = $('.position-lead', section);
    if (lead) {
      gsap.from(splitWords(lead), {
        yPercent: 108,
        opacity: 0,
        stagger: 0.012,
        duration: 0.7,
        ease: EASE,
        scrollTrigger: onEnter(lead, { start: 'top 86%', startH: 'left 80%' }, container)
      });
    }

    var cols = $$('.position-col', grid);
    gsap.from(cols, {
      x: function (i) { return i === 0 ? -70 : 70; },
      opacity: 0,
      duration: 1,
      ease: EASE,
      scrollTrigger: onEnter(grid, { startH: 'left 74%' }, container)
    });

    // Rótulos das colunas.
    gsap.from($$('.position-col small', grid), {
      opacity: 0,
      y: -12,
      stagger: 0.12,
      duration: 0.5,
      ease: 'power2.out',
      scrollTrigger: onEnter(grid, { start: 'top 78%', startH: 'left 70%' }, container)
    });

    // Listas em cascata, coluna por coluna.
    cols.forEach(function (col, ci) {
      gsap.from($$('li', col), {
        clipPath: 'inset(0 0 0 100%)',
        opacity: 0,
        x: 20,
        stagger: 0.08,
        duration: 0.6,
        ease: 'power2.out',
        delay: ci * 0.3,
        scrollTrigger: onEnter(grid, { start: 'top 74%', startH: 'left 66%' }, container)
      });
    });

    var quote = $('.position-quote', section);
    if (quote) {
      gsap.from(splitWords(quote), {
        yPercent: 110,
        opacity: 0,
        stagger: 0.02,
        duration: 0.7,
        ease: EASE,
        scrollTrigger: onEnter(quote, { start: 'top 88%', startH: 'left 55%' }, container)
      });
    }
  }

  /**
   * 5. O GRANDE DIFERENCIAL — a rede em órbita + texto animado.
   *
   * Dividida em duas partes, por motivos diferentes:
   *
   * A) AMBIENTE (contínuo, independe do usuário chegar)
   *    anéis por scrub, halo pulsando e a ÓRBITA dos 4 nós.
   *    Cada nó é envolvido por um `.node-orbit` (criado aqui, ver §6c do
   *    CSS) que cobre a área do visual. Girar o wrapper leva o nó por um
   *    círculo em torno do centro; o nó gira o mesmo tanto no sentido
   *    oposto, então o texto nunca sai da horizontal — roda-gigante.
   *
   * B) SEQUÊNCIA DE ENTRADA (roda com o scroll travado, uma vez só)
   *    núcleo → nós → título → parágrafo → check-list → botão.
   *    É devolvida como timeline PAUSADA para lockedScene() (§2b)
   *    controlar: alinha a seção, trava, roda, destrava.
   */
  function initNetwork() {
    var visual = $('.network-visual');
    if (!visual) return;

    var ORBIT_SECONDS = 46;   // volta completa; alto de propósito — é ambiente, não protagonista
    var MAX_BOOST = 6;        // teto de aceleração por scroll

    /* =========== A) AMBIENTE =========== */

    var ringScrub = function (sel, deg, scrub) {
      gsap.to(sel, {
        rotate: deg, ease: 'none',
        scrollTrigger: { trigger: visual, start: 'top bottom', end: 'bottom top', scrub: scrub }
      });
    };
    ringScrub('.ring-a', 120, 1);
    ringScrub('.ring-b', -140, 1.4);   // tracejado: é neste que o giro se lê
    ringScrub('.ring-c', 90, 1.8);

    // Pulso do halo. Nasce pausado e é ligado/desligado com a órbita.
    var pulse = gsap.to('.network-center', {
      boxShadow: '0 0 0 26px rgba(255, 104, 77, 0.06)',
      duration: 2.4,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      paused: true
    });

    var nodes = $$('.node', visual);
    var orbit = gsap.timeline({ repeat: -1, paused: true });

    nodes.forEach(function (node) {
      var shell = document.createElement('div');
      shell.className = 'node-orbit';
      node.parentNode.insertBefore(shell, node);
      shell.appendChild(node);

      // Wrapper e nó na MESMA duração com ease linear: as duas rotações
      // se cancelam quadro a quadro e o texto fica sempre legível.
      orbit.to(shell, { rotate: 360, duration: ORBIT_SECONDS, ease: 'none' }, 0)
        .to(node, { rotate: -360, duration: ORBIT_SECONDS, ease: 'none' }, 0);
    });

    // Rolar acelera a órbita; ela desacelera sozinha. Fora da tela,
    // órbita e pulso param — nenhum frame gasto com o que ninguém vê.
    var settle;
    ScrollTrigger.create({
      trigger: visual,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function (self) {
        if (orbit.paused()) return;
        var boost = 1 + Math.min(Math.abs(self.getVelocity()) / 320, MAX_BOOST);
        gsap.to(orbit, { timeScale: boost, duration: 0.25, overwrite: true });

        if (settle) settle.kill();
        settle = gsap.delayedCall(0.35, function () {
          gsap.to(orbit, { timeScale: 1, duration: 1.4, overwrite: true });
        });
      },
      onToggle: function (self) {
        if (self.isActive) {
          if (orbit.totalTime() > 0) orbit.play();
          pulse.play();
        } else {
          orbit.pause();
          pulse.pause();
        }
      }
    });

    /* =========== B) SEQUÊNCIA DE ENTRADA (com scroll travado) =========== */

    lockedScene('.network', function (section) {
      var copy = $('.network-copy', section);
      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });

      // Núcleo
      tl.from('.network-center', { scale: 0.5, opacity: 0, duration: 0.55, ease: 'back.out(1.7)' });

      // Nós: cada um vem da sua direção.
      tl.from(nodes, {
        opacity: 0,
        scale: 0.7,
        x: function (i, el) {
          if (el.classList.contains('node-teams')) return 60;
          if (el.classList.contains('node-events')) return -60;
          return 0;
        },
        y: function (i, el) {
          if (el.classList.contains('node-athletes')) return -50;
          if (el.classList.contains('node-courts')) return 50;
          return 0;
        },
        stagger: 0.09,
        duration: 0.6,
        ease: 'back.out(1.4)'
      }, '-=0.25');

      // TEXTO — coluna direita
      if (copy) {
        var eyebrow = $('.eyebrow', copy);
        if (eyebrow) tl.from(eyebrow, { opacity: 0, y: 14, duration: 0.35 }, '-=0.45');

        var h2 = $('h2', copy);
        if (h2) tl.from(splitWords(h2), { yPercent: 115, stagger: 0.035, duration: 0.6 }, '-=0.2');

        var lead = $('p:not(.eyebrow)', copy);
        if (lead) tl.from(splitWords(lead), { yPercent: 108, opacity: 0, stagger: 0.01, duration: 0.5 }, '-=0.3');

        $$('.check-list li', copy).forEach(function (li) {
          tl.from($('i', li), { scale: 0, rotate: -180, duration: 0.4, ease: 'back.out(2.2)' }, '-=0.28')
            .from($('strong', li), { x: 30, opacity: 0, duration: 0.35 }, '-=0.22')
            .from($('span', li), { x: 24, opacity: 0, duration: 0.35 }, '-=0.28');
        });

        var cta = $('.button', copy);
        if (cta) tl.from(cta, { y: 22, opacity: 0, duration: 0.4 }, '-=0.15');
      }

      // A órbita só começa DEPOIS da entrada: se girasse durante, os
      // eixos x/y dos nós já estariam rotacionados e a entrada sairia
      // torta. Usa .add() e não onComplete — este é de lockedScene().
      tl.add(function () { orbit.play(); pulse.play(); });

      return tl;
    });
  }

  /**
   * 7. PLATAFORMA COMPLETA — cards em "deck", com scroll travado.
   * Os parallax internos ficam FORA da timeline travada: são contínuos
   * e ligados ao scroll, não fazem parte da sequência de entrada.
   */
  function initFeatures() {
    var grid = $('.feature-grid');
    if (!grid) return;

    // Parallax contínuo do conteúdo interno de cada card.
    $$('.feature-card', grid).forEach(function (card) {
      if (card.classList.contains('coral-card')) return;   // mapa Leaflet: não mexer
      var inner = $('.mini-ui, .bracket, .social-ui', card);
      if (!inner) return;
      gsap.to(inner, {
        y: -22, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    });

    lockedScene('.features', function (section) {
      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      var head = $('.section-head', section);

      if (head) {
        var eb = $('.eyebrow', head);
        if (eb) tl.from(eb, { opacity: 0, y: 14, duration: 0.35 });
        var h2 = $('h2', head);
        if (h2) tl.from(splitWords(h2), { yPercent: 115, stagger: 0.035, duration: 0.55 }, '-=0.15');
        var sub = $('p:not(.eyebrow)', head);
        if (sub) tl.from(sub, { y: 18, opacity: 0, duration: 0.45 }, '-=0.3');
      }

      tl.from($$('.feature-card', section), {
        // O card do mapa entra junto, mas sem escala: transform no
        // canvas do Leaflet desalinha os tiles.
        y: function (i, el) { return el.classList.contains('coral-card') ? 0 : 64; },
        opacity: 0,
        scale: function (i, el) { return el.classList.contains('coral-card') ? 1 : 0.96; },
        stagger: 0.1,
        duration: 0.6
      }, '-=0.2');

      var avatars = $$('.avatar-row img', section);
      if (avatars.length) tl.from(avatars, { scale: 0, opacity: 0, stagger: 0.06, duration: 0.4, ease: 'back.out(2)' }, '-=0.25');

      var stories = $$('.story-row i', section);
      if (stories.length) tl.from(stories, { scale: 0, stagger: 0.05, duration: 0.35, ease: 'back.out(2)' }, '-=0.3');

      return tl;
    });
  }

  /** 8. BENEFÍCIOS — imagem em parallax + numeração contando 0→N. */
  function initBenefits() {
    var img = $('.benefit-image img');
    if (img) {
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 8, ease: 'none',
        scrollTrigger: { trigger: '.benefit-image', start: 'top bottom', end: 'bottom top', scrub: 0.8 }
      });
      gsap.from('.impact-badge', {
        scale: 0.6, opacity: 0, duration: 0.8, ease: 'back.out(1.6)',
        scrollTrigger: onEnter('.benefit-image', { start: 'top 70%' })
      });
    }

    lockedScene('.benefits', function (section) {
      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      var copy = $('.benefit-copy', section);

      if (copy) {
        var eb = $('.eyebrow', copy);
        if (eb) tl.from(eb, { opacity: 0, y: 14, duration: 0.35 });
        var h2 = $('h2', copy);
        if (h2) tl.from(splitWords(h2), { yPercent: 115, stagger: 0.035, duration: 0.55 }, '-=0.15');
      }

      $$('.benefit-list article', section).forEach(function (item) {
        tl.from(item, { x: 40, opacity: 0, duration: 0.4 }, '-=0.22');

        // Contador: sobe de 0 até o número já impresso no HTML.
        var num = $('b', item);
        if (!num) return;
        var target = parseInt(num.textContent, 10);
        if (isNaN(target)) return;

        var counter = { v: 0 };
        tl.to(counter, {
          v: target,
          duration: 0.45,
          ease: 'power1.out',
          snap: { v: 1 },
          onUpdate: function () {
            num.textContent = String(Math.round(counter.v)).padStart(2, '0');
          }
        }, '-=0.35');
      });

      return tl;
    });
  }

  /** 11 e 12. FAQ e CTA. */
  function initTail() {
    gsap.from($$('.faq-list details'), {
      y: 24, opacity: 0, stagger: 0.07, duration: 0.6, ease: EASE,
      scrollTrigger: onEnter($('.faq-list'))
    });

    var cta = $('.cta');
    if (!cta) return;

    gsap.to('.cta-pattern', {
      y: -80, ease: 'none',
      scrollTrigger: { trigger: cta, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
    });
    gsap.from($$('.contact-form label, .contact-form button'), {
      y: 22, opacity: 0, stagger: 0.08, duration: 0.6, ease: EASE,
      scrollTrigger: onEnter('.contact-form', { start: 'top 84%' })
    });
  }

  /* -----------------------------------------------------------------
     §6 A JORNADA — 4 painéis de tela cheia em scroll horizontal
     Ganhos → Desafio → Transformação → Posicionamento.

     Uma única função monta o conteúdo dos 4 painéis, recebendo a
     timeline horizontal (desktop) ou `null` (mobile, empilhado). Assim
     as animações são descritas UMA vez e servem aos dois layouts —
     evita duas listas de cenas divergindo com o tempo.
     ----------------------------------------------------------------- */
  function initJourneyPanels(container) {
    headingReveal('.statement h2', container);
    headingReveal('.problem h2', container);
    headingReveal('.transform h2', container);
    headingReveal('.position h2', container);

    $$('.journey .eyebrow').forEach(function (eb) { eyebrowReveal(eb, container); });

    initStats(container);
    initProblem(container);
    initTransformPanel(container);
    initPosition(container);
  }

  /**
   * Indicador de progresso do rodapé: barra que avança e rótulo ativo.
   * Cada painel tem seu próprio ScrollTrigger horizontal — o item fica
   * ativo enquanto o painel cruza o centro da tela.
   */
  function initJourneyNav(tl, journey) {
    var rail = $('.journey-nav-rail i', journey);
    if (rail) tl.to(rail, { scaleX: 1, ease: 'none' }, 0);

    var items = $$('.journey-nav li', journey);
    $$('.journey-panel', journey).forEach(function (panel, i) {
      if (!items[i]) return;
      ScrollTrigger.create({
        trigger: panel,
        containerAnimation: tl,
        start: 'left center',
        end: 'right center',
        onToggle: function (self) {
          items[i].classList.toggle('is-active', self.isActive);
        }
      });
    });

    if (items[0]) items[0].classList.add('is-active');
  }

  /** Monta a jornada no desktop: pin + track horizontal + conteúdo. */
  function initJourneyScene() {
    var journey = $('.journey');
    if (!journey) return;

    horizontalScene('.journey', {
      priority: 3,
      // Os quatro painéis têm exatamente 100vw. Ao encerrar o gesto,
      // escolhe o painel mais próximo do centro (portanto, o que está
      // mais presente na tela) e o alinha por inteiro na viewport.
      snap: {
        snapTo: function (progress) { return Math.round(progress * 3) / 3; },
        directional: false,
        inertia: false,
        delay: 0.08,
        duration: { min: 0.18, max: 0.5 },
        ease: 'power1.inOut'
      },
      onTimeline: function (tl) {
        initJourneyPanels(tl);
        initJourneyNav(tl, journey);
      }
    });
  }

  /* -----------------------------------------------------------------
     §7 CENAS PINADAS HORIZONTAIS
     Padrão: pina o .hscroll-viewport (exatamente 100vh) e traduz o
     .hscroll-track em X pela distância que sobra além da viewport.

     `invalidateOnRefresh` + funções para start/end são essenciais:
     a distância depende de innerWidth e precisa ser recalculada em
     resize e depois que fontes/imagens carregam.
     ----------------------------------------------------------------- */
  function horizontalScene(sectionSel, options) {
    var section = $(sectionSel);
    if (!section) return null;

    // O alvo pode ser a própria viewport (caso da .journey) ou uma
    // <section> que a contém (casos .practice / .steps).
    var viewport = section.classList.contains('hscroll-viewport')
      ? section
      : $('.hscroll-viewport', section);
    var track = $('.hscroll-track', section);
    if (!viewport || !track) return null;

    var distance = function () {
      return Math.max(0, track.scrollWidth - window.innerWidth);
    };

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: viewport,
        start: 'top top',
        // Sobra de 40vh no fim para a última carta "respirar" antes do unpin.
        end: function () { return '+=' + (distance() + window.innerHeight * 0.4); },
        pin: true,
        scrub: 0.9,
        // Só a jornada pede snap; as demais cenas horizontais continuam
        // com o comportamento fluido que já tinham.
        snap: options && options.snap,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        // Maior = refrescado primeiro. Os pins precisam recalcular antes
        // das cenas que vêm depois deles na página, senão essas herdam
        // posições de um documento sem os pin-spacers.
        refreshPriority: (options && options.priority) || 0
      }
    });

    tl.to(track, { x: function () { return -distance(); }, ease: 'none' }, 0);

    if (options && options.onTimeline) options.onTimeline(tl, section, track);
    return tl;
  }

  /** 6. NA PRÁTICA — faixa horizontal de 4 cards. */
  function initPracticeScene() {
    horizontalScene('.practice', {
      priority: 2,
      onTimeline: function (tl, section, track) {
        // Cada card ganha um leve "endireitar" enquanto cruza a tela.
        $$('.practice-card', track).forEach(function (card, i) {
          gsap.from(card, {
            rotate: i % 2 ? 3 : -3,
            y: 30,
            opacity: 0,
            duration: 0.6,
            ease: EASE,
            scrollTrigger: {
              trigger: card,
              containerAnimation: tl,
              start: 'left 92%',
              once: true
            }
          });
        });
      }
    });
  }

  /**
   * 9. COMO IMPLEMENTAMOS — 5 etapas na horizontal, com trilha coral
   * que preenche conforme as etapas passam.
   */
  function initStepsScene() {
    horizontalScene('.steps', {
      priority: 1,
      onTimeline: function (tl, section, track) {
        var fill = $('.steps-progress i', section);
        if (fill) tl.to(fill, { scaleX: 1, ease: 'none' }, 0);

        $$('article', track).forEach(function (item) {
          gsap.from($('b', item), {
            scale: 0, rotate: -90, duration: 0.55, ease: 'back.out(1.8)',
            scrollTrigger: { trigger: item, containerAnimation: tl, start: 'left 88%', once: true }
          });
          gsap.from([$('h3', item), $('p', item)], {
            y: 22, opacity: 0, stagger: 0.08, duration: 0.5, ease: EASE,
            scrollTrigger: { trigger: item, containerAnimation: tl, start: 'left 88%', once: true }
          });
        });

        $$('.steps-row > i', track).forEach(function (sep) {
          gsap.from(sep, {
            opacity: 0, x: -14, duration: 0.4,
            scrollTrigger: { trigger: sep, containerAnimation: tl, start: 'left 92%', once: true }
          });
        });
      }
    });
  }

  /* -----------------------------------------------------------------
     §7b SNAP VERTICAL — uma seção por vez

     O snap nativo de CSS não convive bem com os pin-spacers das cenas
     horizontais. Este trigger usa os inícios reais das seções e não
     interfere enquanto o usuário está dentro de um trecho pinado.
     ----------------------------------------------------------------- */
  function initSectionSnap(selector) {
    var snapTrigger;

    var isInsidePinnedScene = function (scrollPosition) {
      return ScrollTrigger.getAll().some(function (trigger) {
        return trigger !== snapTrigger && trigger.vars.pin &&
          scrollPosition > trigger.start && scrollPosition < trigger.end;
      });
    };

    snapTrigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      snap: {
        snapTo: function (progress) {
          var maxScroll = snapTrigger.end - snapTrigger.start;
          var scrollPosition = snapTrigger.start + progress * maxScroll;

          // A jornada, "Na prática" e "Como implementamos" precisam
          // manter o scroll livre para conduzir suas faixas horizontais.
          if (isInsidePinnedScene(scrollPosition)) return progress;

          var targets = $$(selector).map(function (section) {
            return section.getBoundingClientRect().top + window.scrollY;
          });
          var nearest = targets.reduce(function (closest, target) {
            return Math.abs(target - scrollPosition) < Math.abs(closest - scrollPosition)
              ? target : closest;
          }, targets[0]);

          return maxScroll ? nearest / maxScroll : 0;
        },
        directional: false,
        inertia: false,
        delay: 0.08,
        duration: { min: 0.18, max: 0.5 },
        ease: 'power1.inOut'
      }
    });

    return function () { snapTrigger.kill(); };
  }

  /* -----------------------------------------------------------------
     §8 MICROINTERAÇÕES (só em ponteiro fino — nada em touch)
     ----------------------------------------------------------------- */
  function initMagnetic() {
    var setters = new WeakMap();

    $$('.button').forEach(function (btn) {
      setters.set(btn, {
        x: gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' }),
        y: gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' })
      });

      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var s = setters.get(btn);
        s.x((e.clientX - r.left - r.width / 2) * 0.28);
        s.y((e.clientY - r.top - r.height / 2) * 0.38);
      });
      btn.addEventListener('mouseleave', function () {
        var s = setters.get(btn);
        s.x(0); s.y(0);
      });
    });
  }

  function initTilt() {
    $$('.stat-card, .practice-card, .feature-card:not(.coral-card)').forEach(function (card) {
      var rx = gsap.quickTo(card, 'rotateX', { duration: 0.5, ease: 'power3' });
      var ry = gsap.quickTo(card, 'rotateY', { duration: 0.5, ease: 'power3' });

      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        rx((0.5 - (e.clientY - r.top) / r.height) * 8);
        ry(((e.clientX - r.left) / r.width - 0.5) * 8);
      });
      card.addEventListener('mouseleave', function () { rx(0); ry(0); });
    });
  }

  /* -----------------------------------------------------------------
     §9 BOOT
     ----------------------------------------------------------------- */
  function boot() {
    initProgressBar();
    initHeader();
    initAnchors();
    initHero();

    /* ================================================================
       A ORDEM ABAIXO IMPORTA — NÃO REORDENE SEM LER.

       ScrollTriggers com `pin` INSEREM altura na página (pin-spacers).
       As cenas verticais que vêm depois deles na página precisam ser
       criadas DEPOIS, senão calculam start/end sobre um documento sem
       os spacers, ficam com posição muito acima da real e — sendo
       `once: true` — disparam durante o carregamento. Resultado: o
       usuário chega na seção e encontra tudo já animado, parado.

       Foi exatamente esse o bug de "O grande diferencial sem animação".
       Além da ordem, cada pin recebe `refreshPriority` decrescente na
       ordem em que aparece na página, para o refresh recalcular de cima
       para baixo.
       ================================================================ */
    var mm = gsap.matchMedia();

    mm.add(DESKTOP, function () {
      initJourneyScene();   // 4 painéis horizontais — prioridade 3
      initPracticeScene();  // Na prática              — prioridade 2
      initStepsScene();     // Como implementamos      — prioridade 1
      return initSectionSnap('main > section, main > .journey');
    });

    // Mobile: a jornada empilha; as mesmas cenas rodam na vertical.
    mm.add('(max-width: 900px)', function () {
      initJourneyPanels(null);
      return initSectionSnap('main > section, .journey-panel');
    });

    // --- Só agora as cenas verticais posteriores aos pins ---
    // (o h2 da .network entra na timeline travada de initNetwork)
    // Os h2 de .network, .features e .benefits NÃO entram aqui: eles
    // fazem parte das timelines travadas (LOCKED_SECTIONS). Duplicar
    // faria o título animar antes da cena e de novo dentro dela.
    headingReveal('.practice h2');
    headingReveal('.steps h2');
    headingReveal('.faq h2');
    headingReveal('.cta h2');

    // Eyebrows fora da jornada e fora das seções travadas (essas entram
    // na própria timeline da seção, para não animar antes da hora).
    $$('.eyebrow').forEach(function (eb) {
      if (eb.closest('.journey') || inLockedSection(eb)) return;
      eyebrowReveal(eb, null);
    });

    initNetwork();
    initFeatures();
    initBenefits();
    initTail();

    // Ponteiro fino apenas: em touch o hover nunca "solta".
    mm.add('(hover: hover) and (pointer: fine)', function () {
      initMagnetic();
      initTilt();
    });

    // O mapa Leaflet (map.js) monta assíncrono e muda a altura do card.
    // Sem refresh, todos os triggers abaixo dele ficam deslocados.
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    setTimeout(function () { ScrollTrigger.refresh(); }, 1200);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
