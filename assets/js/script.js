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

/* Carrossel da seção de benefícios: teclado e gesto de arrastar,
   sem reprodução automática para não interromper a leitura. */
document.querySelectorAll('.benefit-carousel').forEach((carousel) => {
  const track = carousel.querySelector('.benefit-carousel-track');
  const slides = Array.from(carousel.querySelectorAll('.benefit-slide'));
  const viewport = carousel.querySelector('.benefit-carousel-viewport');
  const previous = carousel.querySelector('.benefit-carousel-prev');
  const next = carousel.querySelector('.benefit-carousel-next');
  let active = 0;
  let touchStart = null;

  const setActive = (index) => {
    active = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${active * 100}%)`;
    slides.forEach((slide, slideIndex) => {
      slide.setAttribute('aria-hidden', String(slideIndex !== active));
    });
  };

  previous.addEventListener('click', () => setActive(active - 1));
  next.addEventListener('click', () => setActive(active + 1));
  viewport.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setActive(active - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); setActive(active + 1); }
  });
  viewport.addEventListener('touchstart', (event) => {
    touchStart = event.changedTouches[0].clientX;
  }, { passive: true });
  viewport.addEventListener('touchend', (event) => {
    if (touchStart === null) return;
    const distance = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(distance) > 35) setActive(active + (distance < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });

  setActive(0);
});

/* CASE — altere `baseDate` e os valores `base` abaixo quando os números
   publicados forem atualizados. A soma diária é pseudoaleatória, porém
   determinística: cada visitante vê o mesmo valor para cada dia. */
const proofCounterConfig = {
  baseDate: '2026-09-10',
  metrics: {
    athletes: { base: 1123, dailyMin: 1, dailyMax: 100 },
    teams: { base: 48, dailyMin: 1, dailyMax: 10 },
    events: { base: 17, dailyMin: 1, dailyMax: 10 },
    courts: { base: 52, dailyMin: 1, dailyMax: 20 }
  }
};

const localDayIndex = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

const hashCounterSeed = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const dailyCounterIncrement = (metricName, day, metric) => {
  let seed = hashCounterSeed(`${proofCounterConfig.baseDate}:${metricName}:${day}`);
  seed += 0x6D2B79F5;
  seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
  seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
  const random = ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  return metric.dailyMin + Math.floor(random * (metric.dailyMax - metric.dailyMin + 1));
};

const proofCounterValue = (metricName, metric) => {
  const [year, month, day] = proofCounterConfig.baseDate.split('-').map(Number);
  const baseDay = Date.UTC(year, month - 1, day) / 86400000;
  const elapsedDays = Math.max(0, localDayIndex(new Date()) - baseDay);
  let value = metric.base;

  for (let elapsedDay = 1; elapsedDay <= elapsedDays; elapsedDay += 1) {
    value += dailyCounterIncrement(metricName, elapsedDay, metric);
  }
  return value;
};

const updateProofCounters = () => {
  document.querySelectorAll('[data-proof-counter]').forEach((counter) => {
    const metricName = counter.dataset.proofCounter;
    const metric = proofCounterConfig.metrics[metricName];
    if (!metric) return;
    counter.textContent = new Intl.NumberFormat('pt-BR').format(proofCounterValue(metricName, metric));
  });
};

const scheduleProofCountersUpdate = () => {
  const nextDay = new Date();
  nextDay.setHours(24, 0, 1, 0);
  window.setTimeout(() => {
    updateProofCounters();
    scheduleProofCountersUpdate();
  }, Math.max(1000, nextDay.getTime() - Date.now()));
};

updateProofCounters();
scheduleProofCountersUpdate();

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
