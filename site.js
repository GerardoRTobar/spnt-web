// Comportamiento compartido: borde del encabezado al hacer scroll, idioma, videos y acordeones.
(function () {
  var LANG = (document.documentElement.lang || 'es').slice(0, 2);
  var T = {
    es: { pause: 'Pausar el video', play: 'Reproducir el video', close: 'Cerrar', hint: 'Este sitio también está en español →' },
    en: { pause: 'Pause video', play: 'Play video', close: 'Close', hint: 'This site is also in English →' },
    pt: { pause: 'Pausar o vídeo', play: 'Reproduzir o vídeo', close: 'Fechar', hint: 'Este site também está em português →' },
    fr: { pause: 'Mettre la vidéo en pause', play: 'Lire la vidéo', close: 'Fermer', hint: 'Ce site existe aussi en français →' },
    de: { pause: 'Video pausieren', play: 'Video abspielen', close: 'Schließen', hint: 'Diese Seite gibt es auch auf Deutsch →' },
    ru: { pause: 'Поставить видео на паузу', play: 'Воспроизвести видео', close: 'Закрыть', hint: 'Этот сайт есть и на русском →' }
  };
  var t = T[LANG] || T.es;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  var header = document.querySelector('header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 4); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // 404: muestra el texto del idioma de la ruta (/en/…, /fr/…). Sin idioma en la ruta, español.
  if (document.body.classList.contains('notfound')) {
    var seg = location.pathname.split('/')[1];
    var block = seg && T[seg] && document.querySelector('[data-nf="' + seg + '"]');
    if (block) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-nf]'), function (b) { b.hidden = b !== block; });
      document.documentElement.lang = seg;
      document.title = block.getAttribute('data-title');
      var skip = document.querySelector('.skip'); if (skip) skip.textContent = block.getAttribute('data-skip');
      var logo = document.querySelector('.logo');
      if (logo) { logo.href = '/' + seg + '/'; logo.setAttribute('aria-label', block.getAttribute('data-home')); }
      LANG = seg; t = T[seg];
    }
  }

  // Selector de idioma: se cierra al tocar fuera, con Escape o cuando el foco sale del menú (Tab).
  var lang = document.querySelector('details.lang');
  if (lang) {
    document.addEventListener('click', function (e) { if (lang.open && !lang.contains(e.target)) lang.open = false; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lang.open) { lang.open = false; lang.querySelector('summary').focus(); }
    });
    lang.addEventListener('focusout', function (e) {
      if (lang.open && e.relatedTarget && !lang.contains(e.relatedTarget)) lang.open = false;
    });
    // Quien elige un idioma a mano ya no necesita la sugerencia de abajo.
    Array.prototype.forEach.call(lang.querySelectorAll('.menu a'), function (a) {
      a.addEventListener('click', function () { store.set('spnt-lang-hint', 'off'); });
    });
  }

  // Sugerencia de idioma: si el idioma preferido del navegador es otro de los seis, un aviso discreto con
  // el enlace a esta misma página en ese idioma. No redirige; al cerrarlo no vuelve a aparecer.
  (function () {
    if (!header || document.body.classList.contains('notfound') || store.get('spnt-lang-hint') === 'off') return;
    var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    var want = null;
    for (var i = 0; i < prefs.length; i++) {
      var code = String(prefs[i]).toLowerCase().slice(0, 2);
      if (T[code]) { want = code; break; }
    }
    if (!want || want === LANG) return;
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + want + '"]');
    if (!alt) return;
    var bar = document.createElement('aside');
    bar.className = 'lang-hint';
    bar.lang = want;
    bar.setAttribute('aria-label', T[want].hint.replace(' →', ''));
    var wrap = document.createElement('div'); wrap.className = 'wrap';
    var a = document.createElement('a');
    a.href = new URL(alt.href).pathname + location.hash; a.hreflang = want; a.textContent = T[want].hint;
    var x = document.createElement('button');
    x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', T[want].close);
    x.addEventListener('click', function () { store.set('spnt-lang-hint', 'off'); bar.remove(); });
    a.addEventListener('click', function () { store.set('spnt-lang-hint', 'off'); });
    wrap.appendChild(a); wrap.appendChild(x); bar.appendChild(wrap);
    header.parentNode.insertBefore(bar, header.nextSibling);
  })();

  // Videos. Con «reducir movimiento» o «ahorro de datos» no arrancan solos: queda el póster y el botón
  // para reproducirlos. Si no, corren solo mientras se ven. Todos tienen botón de pausa (WCAG 2.2.2).
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var auto = !still && !saveData && 'IntersectionObserver' in window;

  function addButton(v, load) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'vbtn paused';
    var sync = function () {
      b.classList.toggle('paused', v.paused);
      b.setAttribute('aria-label', v.paused ? t.play : t.pause);
    };
    b.addEventListener('click', function () {
      if (v.paused) { v.userPaused = false; load(); v.play().catch(function () {}); }
      else { v.userPaused = true; v.pause(); }
    });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    sync();
    v.parentElement.appendChild(b);
  }

  // Video del inicio: elige 16:9 o 9:16 según el ancho y claro u oscuro según el tema. No baja nada
  // hasta que se acerca a la pantalla o se toca reproducir.
  var video = document.querySelector('.pitch-video');
  if (video) {
    var wide = window.matchMedia('(min-width: 761px)');
    var dark = window.matchMedia('(prefers-color-scheme: dark)');
    var visible = false;
    var variant = function () {
      return video.getAttribute('data-src') + '-' + (wide.matches ? 'h' : 'v') + '-' + (dark.matches ? 'dark' : 'light');
    };
    var load = function () {
      var n = variant();
      if (video.getAttribute('data-current') === n) return;
      video.setAttribute('data-current', n);
      video.src = n + '.mp4';
    };
    var pick = function () {
      video.poster = variant() + '.jpg';
      if (video.getAttribute('data-current')) {   // ya se estaba usando: cambia de variante
        var playing = !video.paused;
        load();
        if (playing) video.play().catch(function () {});
      }
    };
    [wide, dark].forEach(function (m) { m.addEventListener ? m.addEventListener('change', pick) : m.addListener(pick); });
    video.autoplay = false;
    pick();
    addButton(video, load);
    if (auto) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !video.userPaused) { load(); video.play().catch(function () {}); }
        else if (!visible) video.pause();
      }, { threshold: 0.25 }).observe(video);
    }
  }

  // Videos de las secciones (loops de la app en el iPhone): se cargan cuando se acercan a la pantalla y
  // corren solo mientras se ven.
  var loops = Array.prototype.slice.call(document.querySelectorAll('video.loop'));
  loops.forEach(function (v) {
    v.loadIt = function () { if (!v.getAttribute('src')) v.src = v.getAttribute('data-loop') + '.mp4'; };
    addButton(v, v.loadIt);
  });
  if (loops.length && auto) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (!v.userPaused) { v.loadIt(); v.play().catch(function () {}); } }
        else v.pause();
      });
    }, { rootMargin: '150px 0px', threshold: 0.2 });
    loops.forEach(function (v) { io.observe(v); });
  }

  // Selector de versión de iOS (tutorial de captura): elegir una versión la elige en todos los métodos
  // y se recuerda en este navegador.
  var iosGroups = Array.prototype.slice.call(document.querySelectorAll('.ios'));
  if (iosGroups.length) {
    var pickIos = function (idx) {
      iosGroups.forEach(function (g) { var r = g.querySelectorAll('input')[idx]; if (r) r.checked = true; });
    };
    var saved = store.get('spnt-ios'); if (saved) pickIos(+saved);
    iosGroups.forEach(function (g) {
      Array.prototype.forEach.call(g.querySelectorAll('input'), function (r, idx) {
        r.addEventListener('change', function () {
          pickIos(idx);
          store.set('spnt-ios', String(idx));
        });
      });
    });
  }

  var sections = Array.prototype.slice.call(document.querySelectorAll('.accordion details'));
  if (!sections.length) return;
  // Mientras se abren varias a la vez (enlace directo o «Abrir todo») la URL no sigue a cada una.
  // Los eventos «toggle» llegan después, en otra tarea; por eso se suelta en un setTimeout.
  var bulk = false;
  var settle = function () { setTimeout(function () { bulk = false; syncToggle(); }, 0); };

  // Abre la sección del enlace (#borrar-datos) para que los links directos funcionen.
  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var target = id && document.getElementById(id);
    var details = target && (target.tagName === 'DETAILS' ? target : target.closest('details'));
    if (!details) return;
    // También abre los desplegables que lo contienen (p. ej. el método que tiene «Hacerlo a mano»); sin
    // `bulk`, el «toggle» del padre reescribiría #apple-pay-a-mano como #apple-pay.
    bulk = true;
    for (var d = details; d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    settle();
    // En una carga nueva el navegador ya saltó con la sección cerrada; se
    // vuelve a saltar sin animación cuando termina de cargar.
    var jump = function () { details.scrollIntoView({ behavior: 'instant' }); };
    if (document.readyState === 'complete') jump();
    else window.addEventListener('load', function () { requestAnimationFrame(jump); });
  }
  window.addEventListener('hashchange', openFromHash);

  // Animación "unfold" (como UnfoldAccordion de easyui.site): la altura se abre,
  // el chevron gira y el contenido sube 4 px a la vez, en un solo movimiento.
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
  sections.forEach(function (d) {
    var summary = d.querySelector('summary');
    var body = d.querySelector('.body');
    if (!summary || !body || still || !body.animate) return;
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

  var toggle = document.querySelector('[data-toggle-all]');
  function allOpen() { return sections.every(function (d) { return d.open; }); }
  var LABELS = {
    es: ['Abrir todo', 'Cerrar todo'], en: ['Expand all', 'Collapse all'], pt: ['Abrir tudo', 'Fechar tudo'],
    fr: ['Tout ouvrir', 'Tout fermer'], de: ['Alle öffnen', 'Alle schließen'], ru: ['Развернуть всё', 'Свернуть всё']
  };
  var labels = LABELS[LANG] || LABELS.es;
  function syncToggle() {
    if (!toggle) return;
    var open = allOpen();
    toggle.textContent = labels[open ? 1 : 0];
    toggle.setAttribute('aria-expanded', String(open));
  }
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      var open = !allOpen();
      bulk = true;
      sections.forEach(function (d) { d.open = open; });
      settle();
      if (!open && history.replaceState) history.replaceState(null, '', location.pathname);
    });
    syncToggle();
  }
  openFromHash();

  // Al imprimir, todo abierto.
  window.addEventListener('beforeprint', function () { sections.forEach(function (d) { d.open = true; }); });
})();

// Botón «Copiar» de los bloques copiables. El resultado se anuncia (aria-live) y, si no se puede copiar,
// el texto queda seleccionado y se dice cómo seguir.
document.querySelectorAll('.copy-btn').forEach(function (b) {
  var LANG = (document.documentElement.lang || 'es').slice(0, 2);
  var FAIL = {
    es: 'No se pudo copiar. El texto ya quedó seleccionado: copialo a mano.',
    en: 'Couldn’t copy. The text is selected: copy it by hand.',
    pt: 'Não deu para copiar. O texto já está selecionado: copie manualmente.',
    fr: 'Copie impossible. Le texte est sélectionné : copiez-le à la main.',
    de: 'Kopieren ging nicht. Der Text ist markiert: kopier ihn von Hand.',
    ru: 'Не удалось скопировать. Текст выделен — скопируйте его вручную.'
  };
  var label = b.textContent;
  var done = b.dataset.done || label;
  var msg = document.createElement('p');
  msg.className = 'copy-msg'; msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
  b.parentElement.insertAdjacentElement('afterend', msg);
  var timer = null;
  b.addEventListener('click', function () {
    var code = b.parentElement.querySelector('code');
    if (!code) return;
    clearTimeout(timer);
    var shown = function () {
      b.textContent = done; b.classList.add('done');
      msg.classList.add('visually-hidden'); msg.textContent = done;   // el botón ya lo dice; esto es para VoiceOver
      timer = setTimeout(function () { b.textContent = label; b.classList.remove('done'); msg.textContent = ''; }, 1800);
    };
    var failed = function () { msg.classList.remove('visually-hidden'); msg.textContent = FAIL[LANG] || FAIL.es; };
    // Sin permiso del portapapeles (o navegador viejo): se selecciona el texto y se copia a la antigua.
    var fallback = function () {
      var r = document.createRange(); r.selectNodeContents(code);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      if (ok) shown(); else failed();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code.textContent).then(shown, fallback);
    else fallback();
  });
});
