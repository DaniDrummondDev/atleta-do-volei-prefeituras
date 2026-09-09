/* ===================================================================
   map.js — Mapa de quadras (OpenStreetMap + Leaflet)
   -------------------------------------------------------------------
   Responsabilidade única: montar o mapa do card "Mapa de quadras",
   centralizá-lo na região de quem está acessando o site e expor um
   ponto de extensão para, no futuro, plotar as quadras vindas do
   banco do Atleta do Vôlei.

   Dependência: Leaflet 1.9.4 (carregado por CDN antes deste arquivo).

   Como estender (integração futura com o banco):
     window.atletaMap.addCourts([
       { nome: 'Quadra Central', lat: -30.03, lng: -51.23, nota: 4.9 }
     ]);
   Basta buscar os dados no endpoint do Atleta do Vôlei e chamar essa
   função — ela cuida dos marcadores, dos popups e do enquadramento.

   Onde pode quebrar:
     - Geolocalização exige HTTPS (ou localhost). Em http:// o navegador
       recusa silenciosamente e caímos no enquadramento padrão.
     - Se o visitante negar a permissão, o mapa continua funcionando,
       apenas sem centralizar nele.
   =================================================================== */

(function () {
  'use strict';

  const container = document.querySelector('#courts-map');
  if (!container) return;

  const statusEl = container.querySelector('[data-map-status]');
  const setStatus = (message) => {
    if (!statusEl) return;
    if (message) statusEl.textContent = message;
    statusEl.hidden = !message;
  };

  if (typeof L === 'undefined') {
    setStatus('Não foi possível carregar o mapa.');
    return;
  }

  // Enquadramento inicial: Brasil inteiro. Serve enquanto a
  // geolocalização não responde e também quando ela é negada.
  const DEFAULT_CENTER = [-14.235, -51.925];
  const DEFAULT_ZOOM = 4;
  const LOCATED_ZOOM = 14;

  const map = L.map(container, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: false,
    // O mapa é decorativo dentro do card: o scroll da página tem prioridade.
    scrollWheelZoom: false,
    attributionControl: true
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    // Atribuição é exigida pela política de uso dos tiles do OpenStreetMap.
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  setStatus('');

  // O card entra na tela com a animação `.reveal` (opacity/transform).
  // Leaflet mede o container no momento da criação, então precisamos
  // recalcular o tamanho depois que a animação termina.
  const refresh = () => map.invalidateSize();
  if ('ResizeObserver' in window) {
    new ResizeObserver(refresh).observe(container);
  } else {
    window.addEventListener('resize', refresh);
  }
  setTimeout(refresh, 400);

  /* ---------- Localização do visitante ---------- */

  const youAreHereIcon = L.divIcon({
    className: 'map-pin map-pin-you',
    html: '<span></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  if (navigator.geolocation) {
    setStatus('Localizando você…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStatus('');
        map.setView([latitude, longitude], LOCATED_ZOOM);
        L.marker([latitude, longitude], { icon: youAreHereIcon })
          .addTo(map)
          .bindPopup('Você está aqui');
      },
      () => {
        // Permissão negada, indisponível ou tempo esgotado: o mapa
        // permanece no enquadramento padrão, sem erro para o usuário.
        setStatus('');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  /* ---------- Ponto de extensão: quadras do banco ---------- */

  const courtIcon = L.divIcon({
    className: 'map-pin map-pin-court',
    html: '<span></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const courtMarkers = L.layerGroup().addTo(map);

  /**
   * Plota as quadras no mapa.
   * @param {Array<{nome: string, lat: number, lng: number, nota?: number}>} courts
   */
  const addCourts = (courts) => {
    courtMarkers.clearLayers();
    if (!Array.isArray(courts) || courts.length === 0) return;

    courts.forEach((court) => {
      if (typeof court.lat !== 'number' || typeof court.lng !== 'number') return;
      const nota = typeof court.nota === 'number' ? `<br><small>★ ${court.nota}</small>` : '';
      L.marker([court.lat, court.lng], { icon: courtIcon })
        .bindPopup(`<strong>${court.nome || 'Quadra'}</strong>${nota}`)
        .addTo(courtMarkers);
    });

    map.fitBounds(L.latLngBounds(courts.map((c) => [c.lat, c.lng])).pad(0.25));
  };

  window.atletaMap = { map, addCourts };
})();
