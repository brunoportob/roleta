import { ItemsStore, normalizeMeta } from './itemsStore.js';
import { Wheel } from './wheel.js';

// --- Estado de UI ---
const ENV = window.electronAPI ? 'electron' : 'web';
const store = new ItemsStore(ENV);
const wheel = new Wheel(store);
let resultsHistory = [];
const HISTORY_KEY = 'roletaHistory';
const MAX_HISTORY = 20;
let fullscreenActive = false;
let fullOverlayEl, fullWheelSlotEl, spinButtonFullEl, confettiLayerEl, cloudLayerEl;
let originalWheelParent = null;
let wheelContainerNextSibling = null;

// ---------- Util -------------
function $(sel){ return document.querySelector(sel); }
function clamp(v,min,max){ return Math.min(max, Math.max(min,v)); }

// ---------- Boot ------------
(async function init(){
  console.time('[INIT] load');
  const loadInfo = await store.load();
  console.timeEnd('[INIT] load');
  console.log('[INIT] Items after load:', store.items, 'meta:', store.meta, 'env:', ENV, 'info:', loadInfo);
  loadHistory();
  cacheDom();
  bindBaseEvents();
  // Garante que o DOM dos botões existe antes de primeira atualização
  requestAnimationFrame(()=>{
    updateInterface();
    if(Object.keys(store.items).length===0){ forceEmptyOverlay(); }
  });
  // Flush imediato ao fechar/atualizar janela
  window.addEventListener('beforeunload', ()=>{ if(store.saveTimeout){ clearTimeout(store.saveTimeout); store.persist(); } });
})();

function forceEmptyOverlay(){
  const ov=document.getElementById('no-items-overlay');
  const wheelSection=document.querySelector('.wheel-section');
  const titleEl=document.getElementById('no-items-title');
  const textEl=document.getElementById('no-items-text');
  if(!ov || !titleEl || !textEl) return;
  if(Object.keys(store.items).length>0) return; // só se realmente vazio
  titleEl.textContent='Nenhum item';
  textEl.textContent='Nenhum item pra sortear.';
  ov.style.display='flex';
  wheelSection?.classList.add('no-items-overlay-active');
}

function cacheDom(){
  fullOverlayEl = $('#wheel-full-overlay');
  fullWheelSlotEl = $('#full-wheel-slot');
  spinButtonFullEl = $('#spin-button-full');
  confettiLayerEl = $('#fx-confetti');
  cloudLayerEl = $('#fx-cloud');
  const wc = $('#wheel-container');
  if(wc){ originalWheelParent = wc.parentElement; wheelContainerNextSibling = wc.nextElementSibling; }
  // Tenta ativar logo central automaticamente se imagem existir
  const logoImg = document.getElementById('center-logo');
  const expandBtn = document.getElementById('expand-wheel');
  if(logoImg && expandBtn){
    // Faz um fetch leve para saber se o arquivo existe
    fetch(logoImg.getAttribute('src'), { method:'GET' }).then(r=>{
      if(r.ok){ logoImg.style.display='block'; expandBtn.classList.add('with-logo'); }
    }).catch(()=>{/* silencioso */});
  }
}

// ---------- Interface Principal ---------
function bindBaseEvents(){
  $('#add-item-inline').addEventListener('click', handleAddItem);
  ['#new-item-name','#new-item-quantity'].forEach(s=>$(s).addEventListener('keypress',e=>{ if(e.key==='Enter') handleAddItem(); }));
  $('#add-placeholder').addEventListener('click', ()=>{ store.addPlaceholder(); updateInterface(); });
  $('#spin-button').addEventListener('click', ()=>{ if(!wheel.wheelSpinning) wheel.spin(handlePrizeResult); syncSpinButtons(); });
  spinButtonFullEl?.addEventListener('click', ()=>{ if(!wheel.wheelSpinning){ wheel.spin(handlePrizeResult); syncSpinButtons(); } });
  // Este botão pode não existir dependendo do modo de overlay; usar encadeamento opcional
  $('#clear-all')?.addEventListener('click', ()=>{ if(confirm('Limpar tudo?')){ store.items={}; wheel.currentRotation=0; updateInterface(); store.scheduleSave(); }});
  $('#focus-add-item')?.addEventListener('click', ()=>{ document.getElementById('new-item-name')?.focus(); });
  $('#open-history')?.addEventListener('click', openHistoryPanel);
  $('#history-close')?.addEventListener('click', closeHistoryPanel);
  $('#history-clear')?.addEventListener('click', ()=>{ if(confirm('Limpar histórico?')){ resultsHistory=[]; persistHistory(); renderHistoryPanel(); }});
  $('#open-prob-panel')?.addEventListener('click', ()=>{ $('#prob-overlay').style.display='flex'; });
  const range = document.getElementById('prob-item-range');
  if(range){
    range.addEventListener('input', ()=>{
      const val = parseInt(range.value)||50;
      document.getElementById('prob-item-display').textContent = val;
      document.getElementById('prob-none-display').textContent = (100-val);
    });
  }
  $('#close-prob')?.addEventListener('click', ()=>{ const val=parseInt(range.value)||50; store.updateItemChancePercent(clamp(val,0,100)); $('#prob-overlay').style.display='none'; updateInterface(); });
  // Botão central: fora do fullscreen expande; dentro do fullscreen gira a roleta
  const expandBtn = document.getElementById('expand-wheel');
  if(expandBtn){
    expandBtn.addEventListener('click', ()=>{
      if(fullscreenActive){
        if(!wheel.wheelSpinning){ wheel.spin(handlePrizeResult); syncSpinButtons(); }
      } else {
        enterFullscreen();
      }
    });
    // Marca para evitar segundo binding pelo MutationObserver
    expandBtn.__expandBound = true;
  }
  // Se por algum motivo o botão for recriado, observar mutações e reanexar
  const wheelCenter=document.querySelector('.wheel-center');
  if(wheelCenter){
    const mo=new MutationObserver(()=>{
      const btn=document.getElementById('expand-wheel');
      if(btn && !btn.__expandBound){
        btn.addEventListener('click', ()=>{ fullscreenActive? (!wheel.wheelSpinning && wheel.spin(handlePrizeResult) && syncSpinButtons()) : enterFullscreen(); });
        btn.__expandBound=true;
        console.log('[BIND] expand-wheel reattached');
      }
    });
    mo.observe(wheelCenter, { childList:true, subtree:true });
  }
  console.log('[BIND] expand-wheel handler bound');
  // fallback: clique no círculo central também expande
  document.querySelector('.wheel-center')?.addEventListener('click', (e)=>{
    if(e.target && (e.target.id==='expand-wheel')) return; // já tratado
    if(fullscreenActive){
      if(!wheel.wheelSpinning){ wheel.spin(handlePrizeResult); syncSpinButtons(); }
    } else {
      enterFullscreen();
    }
  });
  $('#close-full')?.addEventListener('click', exitFullscreen);
  // Clique fora da roleta (overlay) fecha fullscreen
  fullOverlayEl?.addEventListener('click', (e)=>{
    if(!fullscreenActive) return;
    const wheelContainer = document.getElementById('wheel-container');
    if(wheelContainer && !wheelContainer.contains(e.target)){ exitFullscreen(); }
  });
}

function handleAddItem(){
  const name = $('#new-item-name').value.trim();
  let qtyRaw = $('#new-item-quantity').value.trim(); if(!qtyRaw) qtyRaw='1';
  const qty = parseInt(qtyRaw);
  if(!name){ alert('Informe um nome.'); return; }
  if(isNaN(qty) || qty<=0){ alert('Quantidade precisa ser >= 1'); return; }
  store.addItem(name, qty);
  $('#new-item-name').value=''; $('#new-item-quantity').value='';
  updateInterface();
}

function updateInterface(){
  const has = Object.keys(store.items).length>0;
  if(has){
    wheel.render(); createItemsEditList(); $('#spin-button').disabled=false;
  } else {
    $('#wheel-segments').innerHTML=''; $('#items-edit-list').innerHTML=''; $('#spin-button').disabled=true;
    // Fallback imediato para exibir overlay vazio antes mesmo de checkGameStatus (caso algum retorno precoce ocorra)
    showEmptyOverlaySimplified();
  }
  const pct = store.meta.itemChancePercent ?? 50;
  const range = document.getElementById('prob-item-range');
  if(range){ range.value = pct; }
  const pid = document.getElementById('prob-item-display'); if(pid) pid.textContent = pct;
  const pnd = document.getElementById('prob-none-display'); if(pnd) pnd.textContent = 100 - pct;
  checkGameStatus();
  syncSpinButtons();
  updatePlaceholderButton();
}

function syncSpinButtons(){
  if(spinButtonFullEl){ spinButtonFullEl.disabled = $('#spin-button').disabled; }
}
function updatePlaceholderButton(){
  const label = $('#placeholder-add-label'); if(!label) return;
  const count = Object.keys(store.items).filter(n=>n.startsWith('Nenhum item')).length;
  label.textContent = count ? `Não foi dessa vez (+) (${count})` : 'Não foi dessa vez (+)';
}

function checkGameStatus(){
  const positives = Object.entries(store.items).filter(([n,q])=>!n.startsWith('Nenhum item') && q>0);
  const totalItems = Object.keys(store.items).length;
  const overlay = $('#no-items-overlay');
  const wheelSection = document.querySelector('.wheel-section');
  const titleEl = document.getElementById('no-items-title');
  const textEl = document.getElementById('no-items-text');
  const actionsEl = document.getElementById('no-items-actions');
  if(!overlay || !titleEl || !textEl || !actionsEl) return;

  if(positives.length===0){
    $('#spin-button').disabled=true;
    wheelSection?.classList.add('no-items-overlay-active');
    overlay.style.display='flex';
    actionsEl.innerHTML='';
    if(totalItems===0){
      // Estado vazio
      overlay.querySelector('.no-items-card').dataset.mode='empty';
      titleEl.textContent='Nenhum item';
      textEl.textContent='Nenhum item pra sortear.';
      actionsEl.innerHTML='';
    } else {
      // Finalizado (todos itens consumidos ou zerados)
      overlay.querySelector('.no-items-card').dataset.mode='finished';
      titleEl.textContent='Fim';
      textEl.textContent='Todos os itens foram sorteados!';
      actionsEl.innerHTML='<button id="clear-all-finish" type="button">Limpar tudo</button>';
      document.getElementById('clear-all-finish')?.addEventListener('click', ()=>{
        if(confirm('Limpar tudo?')){ store.items={}; wheel.currentRotation=0; updateInterface(); store.scheduleSave(); }
      });
    }
  } else {
    overlay.style.display='none';
    wheelSection?.classList.remove('no-items-overlay-active');
    if(!wheel.wheelSpinning) $('#spin-button').disabled=false;
  }
}

function showEmptyOverlaySimplified(){
  if(Object.keys(store.items).length!==0) return; // só quando realmente vazio
  const overlay = document.getElementById('no-items-overlay');
  const wheelSection = document.querySelector('.wheel-section');
  const titleEl = document.getElementById('no-items-title');
  const textEl = document.getElementById('no-items-text');
  if(!overlay || !titleEl || !textEl) return;
  titleEl.textContent='Nenhum item';
  textEl.textContent='Nenhum item pra sortear.';
  overlay.style.display='flex';
  wheelSection?.classList.add('no-items-overlay-active');
}

// ---------- Lista de Itens ----------
function createItemsEditList(){
  const el = $('#items-edit-list'); el.innerHTML='';
  Object.keys(store.items).forEach(name=>{
    const isPlaceholder = name.startsWith('Nenhum item');
    const div=document.createElement('div'); div.className='item-edit';
    if(isPlaceholder){
      // Placeholder simplificado: apenas label e botão excluir direto (sem itálico)
      div.innerHTML = `<span style="flex:1; color:#666;">Não foi dessa vez</span>
        <button class="delete-button" data-act="del">Excluir</button>`;
      div.querySelector('[data-act="del"]').onclick=()=>{ store.delete(name); updateInterface(); };
    } else {
      const displayName = name;
      div.innerHTML=`<input type="text" class="item-name-edit" value="${displayName}" data-original="${name}">
        <input type="number" class="item-quantity-edit" value="${store.items[name]}" min="0">
        <button class="edit-button" data-act="save">Salvar</button>
        <button class="delete-button" data-act="del">Excluir</button>`;
      div.querySelector('[data-act="save"]').onclick=()=>{
        const newName = div.querySelector('.item-name-edit').value.trim();
        const q = parseInt(div.querySelector('.item-quantity-edit').value)||0;
        if(!newName){ alert('Nome inválido'); return; }
        if(newName!==name) delete store.items[name];
        if(q>0) store.items[newName]=q; else delete store.items[newName];
        store.scheduleSave();
        updateInterface();
      };
      div.querySelector('[data-act="del"]').onclick=()=>{ if(confirm('Excluir?')){ store.delete(name); updateInterface(); } };
    }
    el.appendChild(div);
  });
}

// ---------- Resultado / Histórico / Destaque ----------
function handlePrizeResult(name, idx){
  const isNone = name.startsWith('Nenhum item');
  if(isNone){ triggerCloud(); showToast('Não foi dessa vez','none'); }
  else if(store.items[name]>0){ store.decrement(name); triggerConfetti(); showToast('Você tirou: '+name+'!','win'); }
  highlightSegment(idx); pushHistory(isNone? 'Não foi dessa vez': name, isNone); updateInterface();
}

function showToast(text, type){
  const old=$('.result-toast'); if(old) old.remove();
  const div=document.createElement('div'); div.className='result-toast '+(type||''); div.textContent=text; document.body.appendChild(div); setTimeout(()=>div.remove(),3800);
}
function highlightSegment(index){
  const seg = document.querySelector(`#wheel-segments path[data-seg-index="${index}"]`); if(!seg) return; seg.classList.add('winner-highlight'); setTimeout(()=>seg.classList.remove('winner-highlight'), 3000);
}
function pushHistory(label, isNone){
  const ts=new Date();
  resultsHistory.unshift({ label, isNone, time: ts.toLocaleTimeString() });
  if(resultsHistory.length>MAX_HISTORY) resultsHistory.pop();
  persistHistory();
  if(historyPanelOpen()) renderHistoryPanel();
}
function persistHistory(){
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(resultsHistory)); } catch{}
}
function loadHistory(){
  try { const raw=localStorage.getItem(HISTORY_KEY); if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr)) resultsHistory=arr; } } catch{}
}

// Overlay history panel
function historyPanelOpen(){ return document.getElementById('history-overlay')?.style.display==='flex'; }
function openHistoryPanel(){ const ov=$('#history-overlay'); if(!ov) return; ov.style.display='flex'; renderHistoryPanel(); }
function closeHistoryPanel(){ const ov=$('#history-overlay'); if(!ov) return; ov.style.display='none'; }
function renderHistoryPanel(){ const list=$('#history-list'); if(!list) return; list.innerHTML=''; if(!resultsHistory.length){ const li=document.createElement('li'); li.innerHTML='<em style="opacity:.6">Vazio</em>'; list.appendChild(li); return; } resultsHistory.forEach(r=>{ const li=document.createElement('li'); li.innerHTML=`<span class="${r.isNone?'none':''}">${r.label}</span><span>${r.time}</span>`; list.appendChild(li); }); }

// ---------- Fullscreen & Efeitos ----------
function enterFullscreen(){
  if(fullscreenActive) { console.log('[FULLSCREEN] already active'); return; }
  fullscreenActive=true; console.log('[FULLSCREEN] entering');
  if(fullOverlayEl){ fullOverlayEl.style.display='flex'; fullOverlayEl.classList.add('showing'); }
  const container=$('#wheel-container'); if(fullWheelSlotEl && container){ fullWheelSlotEl.appendChild(container); }
  $('#expand-wheel')?.classList.add('toggle-close');
  // Esconde botão inferior (não será mais usado) e usa botão central para girar
  if(spinButtonFullEl){ spinButtonFullEl.style.display='none'; }
  // Oculta também o botão original da tela base para não aparecer atrás do overlay
  const baseSpin = document.getElementById('spin-button');
  if(baseSpin){ baseSpin.classList.add('hidden-during-full'); }
  updateInterface();
  updateCenterButtonMode();
}
function exitFullscreen(){
  if(!fullscreenActive){ console.log('[FULLSCREEN] not active to exit'); return; }
  fullscreenActive=false; console.log('[FULLSCREEN] exiting');
  if(fullOverlayEl){ fullOverlayEl.style.display='none'; fullOverlayEl.classList.remove('showing'); }
  const container=$('#wheel-container'); if(originalWheelParent && container){ if(wheelContainerNextSibling && wheelContainerNextSibling.parentElement===originalWheelParent){ originalWheelParent.insertBefore(container, wheelContainerNextSibling); } else { originalWheelParent.appendChild(container); } }
  $('#expand-wheel')?.classList.remove('toggle-close');
  if(spinButtonFullEl){ spinButtonFullEl.style.display=''; }
  const baseSpin = document.getElementById('spin-button');
  if(baseSpin){ baseSpin.classList.remove('hidden-during-full'); }
  updateInterface();
  updateCenterButtonMode();
}
function triggerConfetti(){ if(!confettiLayerEl) return; confettiLayerEl.style.display='block'; confettiLayerEl.innerHTML=''; const colors=['#ff4757','#1e90ff','#2ed573','#ffa502','#eccc68','#ff6b81','#3742fa']; const total=80; const frag=document.createDocumentFragment(); for(let i=0;i<total;i++){ const d=document.createElement('div'); d.className='confetti-piece'; const sz=6+Math.random()*8; d.style.width=sz+'px'; d.style.height=(sz*1.2)+'px'; d.style.background=colors[Math.floor(Math.random()*colors.length)]; d.style.left=(Math.random()*100)+'%'; d.style.top='-30px'; d.style.opacity='1'; d.style.animationDelay=(Math.random()*0.7)+'s'; frag.appendChild(d);} confettiLayerEl.appendChild(frag); setTimeout(()=>{ if(confettiLayerEl){ confettiLayerEl.style.display='none'; confettiLayerEl.innerHTML=''; } },3000); }
function triggerCloud(){ if(!cloudLayerEl) return; cloudLayerEl.style.display='block'; cloudLayerEl.classList.add('fx-cloud-active'); setTimeout(()=>{ if(cloudLayerEl){ cloudLayerEl.style.display='none'; cloudLayerEl.classList.remove('fx-cloud-active'); } },1600); }

// Expor para debug opcional
window.__roletaDebug = { store, wheel, getHistory:()=>resultsHistory };

// Atualiza aparência e função do botão central dependendo do modo
function updateCenterButtonMode(){
  const btn=document.getElementById('expand-wheel'); if(!btn) return;
  const iconSpan = btn.querySelector('.center-icon');
  // Não alteramos innerHTML para preservar <img>
  if(fullscreenActive){
    btn.classList.add('spin-mode');
    if(iconSpan){ iconSpan.textContent='⟳'; iconSpan.style.display = btn.classList.contains('with-logo') ? 'none':'inline'; }
    btn.title='Girar roleta';
  } else {
    btn.classList.remove('spin-mode');
    if(iconSpan){ iconSpan.textContent='⛶'; iconSpan.style.display = btn.classList.contains('with-logo') ? 'none':'inline'; }
    btn.title='Expandir roleta';
  }
}
