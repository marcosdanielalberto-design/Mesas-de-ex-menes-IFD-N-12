(() => {
  const cfg = window.MESAS_PAGES_CONFIG || {};
  const state = { preview: [], period: null };
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function callApi(api, payload = {}) {
    return new Promise((resolve, reject) => {
      const callback = `mesasPages_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => { cleanup(); reject(new Error('La respuesta del backend tardó demasiado.')); }, 30000);
      const cleanup = () => { clearTimeout(timer); delete window[callback]; script.remove(); };
      window[callback] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('No se pudo conectar con Apps Script.')); };
      const query = new URLSearchParams({ api, callback, payload: JSON.stringify(payload) });
      script.src = `${cfg.backendUrl}?${query.toString()}`;
      document.body.appendChild(script);
    });
  }

  function showResult(value) { $('periodResult').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
  function setConnection(text, error = false) { $('connectionState').textContent = text; $('connectionState').style.background = error ? '#ffe5e5' : ''; }

  function renderPeriod(res) {
    state.period = res;
    $('periodModel').innerHTML = res && res.ok ? `<strong>${esc(res.modelo)}</strong><p>Período: ${esc(res.periodId)}</p><p>1er llamado: ${(res.dias?.primerLlamado || []).length} días · 2do llamado: ${(res.dias?.segundoLlamado || []).length} días · Overrides: ${esc(res.overrides || 0)}</p>` : `<span class="badge err">${esc(res?.message || 'No se pudo leer el período')}</span>`;
  }

  function renderCronograma(items) {
    state.preview = Array.isArray(items) ? items : [];
    const term = String($('cronogramaFilter').value || '').toLowerCase();
    const rows = state.preview.filter(r => !term || [r.codigoPe,r.espacio,r.plan,r.anio,r.aula,r.docentes,r.fecha].join(' ').toLowerCase().includes(term));
    const groups = {};
    rows.forEach(r => (groups[r.fecha || 'Sin fecha'] ||= []).push(r));
    const dayName = date => { const d = new Date(`${date}T12:00:00`); return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' }); };
    const card = r => `<article class="mesa-card"><div class="mesa-time">${esc(r.horaInicio || 'Horario a confirmar')} <span class="badge">${esc(r.llamado || '')}</span></div><div class="mesa-main"><h3>${esc(r.espacio || 'Espacio sin nombre')}</h3><p class="mesa-meta">Código ${esc(r.codigoPe || '')} · Plan ${esc(r.plan || '')} · Año ${esc(r.anio || '')} · Aula ${esc(r.aula || 'A confirmar')}</p><p class="mesa-docentes"><strong>Tribunal:</strong> ${esc(r.docentes || 'Docentes a confirmar')}</p></div></article>`;
    $('cronogramaTable').innerHTML = rows.length ? Object.keys(groups).sort().map(date => `<section class="day-group"><header><span class="day-number">${esc(date.slice(8,10) || '')}</span><div><p class="eyebrow">Jornada de exámenes</p><h3>${esc(dayName(date))}</h3></div><span class="day-count">${groups[date].length} mesa(s)</span></header><div class="mesa-list">${groups[date].sort((a,b)=>String(a.horaInicio).localeCompare(String(b.horaInicio)) || Number(a.anio||0)-Number(b.anio||0)).map(card).join('')}</div></section>`).join('') : '<div class="empty">No hay mesas para mostrar.</div>';
    $('metrics').innerHTML = `<div class="metric"><strong>${state.preview.length}</strong><span>Mesas</span></div><div class="metric"><strong>${state.preview.filter(r=>r.ajustado==='SI').length}</strong><span>Ajustes manuales</span></div><div class="metric"><strong>${new Set(state.preview.flatMap(r=>String(r.docentes||'').split('|').map(x=>x.trim()).filter(Boolean))).size}</strong><span>Docentes vinculados</span></div><div class="metric"><strong>${state.preview.filter(r=>!r.aula).length}</strong><span>Sin aula</span></div>`;
  }

  async function refresh() {
    try {
      setConnection('Conectada');
      const period = await callApi('M2_PERIOD_MODEL'); renderPeriod(period);
      const preview = await callApi('M2_PREVIEW'); renderCronograma(preview.items || []);
      const vals = await callApi('M2_VALIDACIONES', { limit: 40 }); renderValidaciones(vals.items || []);
    } catch (error) { setConnection('Sin conexión', true); showResult({ ok:false, message:error.message }); }
  }

  function renderValidaciones(items) { $('validacionesBox').innerHTML = (items || []).length ? items.map(v => `<div class="card"><span class="badge ${String(v.nivel).toUpperCase()==='ERROR'?'err':'warn'}">${esc(v.nivel)}</span> <strong>${esc(v.tipo)}</strong><p>${esc(v.codigoPe)} ${esc(v.espacio)}</p><p>${esc(v.detalle)}</p></div>`).join('') : '<div class="empty">Sin validaciones recientes.</div>'; }

  async function generate() { showResult('Generando cronograma base...'); try { const res = await callApi('M2_GENERATE'); showResult(res); await refresh(); } catch (error) { showResult({ok:false,message:error.message}); } }
  async function loadDocentes() { try { const res = await callApi('M2_REPORTE_DOCENTES'); $('docentesBox').innerHTML = (res.items || []).map(x => `<div class="card"><h3>${esc(x.docente)}</h3><p>${esc(x.totalMesas)} mesa(s)</p><pre>${esc(x.mensaje)}</pre></div>`).join('') || '<div class="empty">Sin docentes asignados.</div>'; } catch (error) { $('docentesBox').textContent = error.message; } }
  async function syncPlanta() { const box = $('plantaResult'); box.textContent = 'Sincronizando Planta Funcional...'; try { box.textContent = JSON.stringify(await callApi('M2_SYNC_PLANTA'), null, 2); } catch (error) { box.textContent = error.message; } }
  async function rebuildSeleccion() { const box = $('plantaResult'); box.textContent = 'Reconstruyendo selección...'; try { box.textContent = JSON.stringify(await callApi('M2_REBUILD_SELECCION'), null, 2); } catch (error) { box.textContent = error.message; } }
  async function exportFile(kind) { const box = $('exportBox'); box.textContent = 'Preparando archivo...'; try { const res = await callApi(kind === 'PDF' ? 'M2_EXPORT_LOCAL_PDF' : 'M2_EXPORT_LOCAL_XLSX'); if (!res.ok) throw new Error(res.message); const a = document.createElement('a'); a.href = `data:${res.mimeType};base64,${res.base64}`; a.download = res.fileName || 'mesas'; a.click(); box.textContent = 'Archivo preparado para descargar.'; } catch (error) { box.textContent = error.message; } }

  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn)); document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id===`panel-${btn.dataset.panel}`)); }));
  $('refreshBtn').addEventListener('click', refresh); $('generateBtn').addEventListener('click', generate); $('docentesBtn').addEventListener('click', loadDocentes); $('cronogramaFilter').addEventListener('input', () => renderCronograma(state.preview)); $('exportXlsxBtn').addEventListener('click', () => exportFile('XLSX')); $('exportPdfBtn').addEventListener('click', () => exportFile('PDF')); $('loadConfigBtn').addEventListener('click', refresh); $('savePeriodBtn').addEventListener('click', async () => { showResult(await callApi('M2_SAVE_PERIOD', {})); await refresh(); });
  $('syncPlantaBtn').addEventListener('click', syncPlanta); $('rebuildSeleccionBtn').addEventListener('click', rebuildSeleccion);
  $('institutionTitle').textContent = cfg.institution || $('institutionTitle').textContent; $('appTitle').textContent = cfg.title || $('appTitle').textContent;
  refresh();
})();
