const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-nav');

menuButton.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
});

navigation.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

/* Reveal por IntersectionObserver — camada BASE de animação.
   Só roda quando animations.js NÃO assumiu (CDN do GSAP fora do ar ou
   `prefers-reduced-motion`). Se as duas rodassem juntas, o mesmo
   elemento receberia transição CSS e tween GSAP ao mesmo tempo. */
if (!window.__gsapEnhanced) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}

/* ---------------------------------------------------------------
   FAQ — acordeão exclusivo e animado
   Em navegadores atuais nada disto roda: o atributo `name` do <details>
   já fecha as demais perguntas e o `::details-content` do CSS anima a
   altura. Este bloco é o fallback para quem não tem `::details-content`.
   --------------------------------------------------------------- */
if (!CSS.supports('selector(::details-content)')) {
  const faqItems = Array.from(document.querySelectorAll('.faq-list details'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DURATION = 340;

  // Anima a altura do painel. `open` já deve estar true, para que o
  // conteúdo esteja no layout e possa ser medido.
  const slide = (item, opening) => {
    const panel = item.querySelector('p');
    if (!panel) return Promise.resolve();

    const full = panel.scrollHeight;
    panel.style.overflow = 'hidden';

    const animation = panel.animate(
      {
        height: opening ? ['0px', `${full}px`] : [`${full}px`, '0px'],
        opacity: opening ? [0, 1] : [1, 0]
      },
      { duration: DURATION, easing: 'ease' }
    );

    return animation.finished.then(() => {
      panel.style.removeProperty('overflow');
    });
  };

  const close = (item) => {
    if (!item.open || item.dataset.busy) return Promise.resolve();
    item.dataset.busy = 'true';
    return slide(item, false).then(() => {
      item.open = false;
      delete item.dataset.busy;
    });
  };

  faqItems.forEach((item) => {
    const summary = item.querySelector('summary');

    summary.addEventListener('click', (event) => {
      // O toggle passa a ser controlado aqui, para animar antes de fechar.
      event.preventDefault();
      if (item.dataset.busy) return;

      if (item.open) {
        if (reduceMotion) item.open = false;
        else close(item);
        return;
      }

      faqItems.forEach((other) => {
        if (other !== item) {
          if (reduceMotion) other.open = false;
          else close(other);
        }
      });

      item.open = true;
      if (!reduceMotion) slide(item, true);
    });
  });
}

const form = document.querySelector('#lead-form');
const status = form.querySelector('.form-status');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const firstName = new FormData(form).get('nome').trim().split(' ')[0];
  status.textContent = `Obrigado, ${firstName}! Em breve nossa equipe entrará em contato.`;
  form.reset();
});
