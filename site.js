// Comportamiento compartido: borde del encabezado al hacer scroll y acordeones.
(function () {
  var header = document.querySelector('header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 4); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  var sections = Array.prototype.slice.call(document.querySelectorAll('.accordion details'));
  if (!sections.length) return;

  // Abre la sección del enlace (#borrar-datos) para que los links directos funcionen.
  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var target = id && document.getElementById(id);
    var details = target && (target.tagName === 'DETAILS' ? target : target.closest('details'));
    if (details) {
      details.open = true;
      details.scrollIntoView();
    }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  // Animación "unfold" (como UnfoldAccordion de easyui.site): la altura se abre,
  // el chevron gira y el contenido sube 4 px a la vez, en un solo movimiento.
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
  sections.forEach(function (d) {
    var summary = d.querySelector('summary');
    var body = d.querySelector('.body');
    if (!summary || !body || reduce || !body.animate) return;
    var running = null;
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      if (running) running.cancel();
      var opening = !d.open;
      var from = opening ? 0 : body.offsetHeight;
      if (opening) d.open = true;
      var to = opening ? body.scrollHeight : 0;
      d.classList.toggle('closing', !opening);
      body.style.overflow = 'hidden';
      running = body.animate([
        { height: from + 'px', opacity: opening ? 0 : 1, transform: 'translateY(' + (opening ? -4 : 0) + 'px)' },
        { height: to + 'px', opacity: opening ? 1 : 0, transform: 'translateY(' + (opening ? 0 : -4) + 'px)' }
      ], { duration: opening ? 340 : 260, easing: EASE });
      running.onfinish = function () {
        running = null;
        body.style.overflow = '';
        d.classList.remove('closing');
        if (!opening) d.open = false;
      };
    });
  });

  // Al abrir una sección, la URL apunta a ella (para compartir el enlace).
  sections.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open && d.id && !bulk && history.replaceState) history.replaceState(null, '', '#' + d.id);
      syncToggle();
    });
  });

  var bulk = false;
  var toggle = document.querySelector('[data-toggle-all]');
  function allOpen() { return sections.every(function (d) { return d.open; }); }
  function syncToggle() {
    if (!toggle) return;
    var open = allOpen();
    toggle.textContent = open ? 'Cerrar todo' : 'Abrir todo';
    toggle.setAttribute('aria-expanded', String(open));
  }
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      var open = !allOpen();
      bulk = true;
      sections.forEach(function (d) { d.open = open; });
      // Los eventos "toggle" llegan después, en otra tarea.
      setTimeout(function () { bulk = false; syncToggle(); }, 0);
      if (!open && history.replaceState) history.replaceState(null, '', location.pathname);
    });
    syncToggle();
  }

  // Al imprimir, todo abierto.
  window.addEventListener('beforeprint', function () { sections.forEach(function (d) { d.open = true; }); });
})();
