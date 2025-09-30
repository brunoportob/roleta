// Responsável por carregar, salvar e normalizar items/meta
// Agora usamos um único controle percentual: itemChancePercent (0..100)
// probItem/probNone internos são derivados quando necessário.
export const DEFAULT_META = { itemChancePercent: 50 };

function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

export function normalizeMeta(m){
  if(!m) return { ...DEFAULT_META };
  // Compat retro: se vier probItem/probNone antigos, converte média proporcional
  if(m.itemChancePercent !== undefined){
    return { itemChancePercent: clamp(m.itemChancePercent, 0, 100) };
  }
  if(m.probItem !== undefined && m.probNone !== undefined){
    // converte pesos antigos em proporção: itemChancePercent = (pesoItem) / (pesoItem + pesoNone) * 100
    const pi = clamp(m.probItem,1,10000);
    const pn = clamp(m.probNone,1,10000);
    return { itemChancePercent: Math.round(pi/(pi+pn)*100) };
  }
  if(m.prob !== undefined){
    // formato muito antigo - assume equilíbrio 50/50
    return { itemChancePercent: 50 };
  }
  return { ...DEFAULT_META };
}

export class ItemsStore {
  constructor(env){
    this.env = env; // 'electron' | 'web'
    this.items = {}; // nome -> quantidade (placeholders = 0)
  this.meta = { ...DEFAULT_META };
    this.saveTimeout = null;
    this._lastPersistTs = 0; // marca persistências locais recentes
  }
  loadLocal(){
    const saved = localStorage.getItem('roletaItems');
    if(saved){
      try { const parsed = JSON.parse(saved); if(parsed.items) this.items = parsed.items; if(parsed.meta) this.meta = normalizeMeta(parsed.meta); } catch{}
    }
  }
  async load(){
    if(this.env==='electron'){
      try {
        const res = await window.electronAPI.readItems();
        if(res && res.ok){
          const fileItems = res.items || {};
          const fileIsEmpty = Object.keys(fileItems).length===0;
          this.meta = normalizeMeta(res.meta);
          if(fileIsEmpty){
            // tenta recuperar do localStorage
            const saved = localStorage.getItem('roletaItems');
            if(saved){
              try{ const parsed = JSON.parse(saved); if(parsed.items && Object.keys(parsed.items).length){ this.items = parsed.items; if(parsed.meta) this.meta = normalizeMeta(parsed.meta); }
              }catch{}
            }
            if(Object.keys(this.items).length===0){ this.items = fileItems; } // ainda vazio
            // persiste novamente para arquivo se recuperou algo
            if(Object.keys(this.items).length){ this.persist(); }
          } else {
            this.items = fileItems;
          }
          return { loaded:true, source:'electron' };
        }
      } catch(e){ console.warn('[STORE] falha load electron', e); }
      this.loadLocal(); return { loaded:true, source:'local-fallback' };
    } else {
      // Modo web simples: tenta endpoint HTTP (se servidor rodando) senão localStorage
      try {
        const res = await fetch(`${window.location.origin}/api/items`);
        if(res.ok){
          const data = await res.json();
          this.items = data.items||{}; this.meta = normalizeMeta(data.meta);
          return { loaded:true, source:'http' };
        }
      } catch(e){ /* silencioso */ }
      this.loadLocal(); return { loaded:true, source:'local-fallback' };
    }
  }
  scheduleSave(){
    if(this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(()=>this.persist(), 400);
  }
  async persist(){
    const payload = { items: this.items, meta: this.meta };
    localStorage.setItem('roletaItems', JSON.stringify(payload));
    if(this.env==='electron'){
      try { const r = await window.electronAPI.writeItems(payload); if(!r.ok) console.warn('Falha salvar (electron)', r.error); } catch(e){ console.warn(e); }
      return;
    }
    try { await fetch(`${window.location.origin}/api/items`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); } catch(e){ /* ignora */ }
  }
  addItem(name, qty){
    if(!name) return;
    if(this.items[name]) this.items[name]+=qty; else this.items[name]=qty;
    this.scheduleSave();
  }
  addPlaceholder(){
    const base='Nenhum item'; let idx=1; let candidate=base;
    while(this.items[candidate]!==undefined){ idx++; candidate = base + ' ' + idx; }
    this.items[candidate]=0; this.scheduleSave();
  }
  decrement(name){ if(this.items[name]>0){ this.items[name]--; this.scheduleSave(); } }
  delete(name){ delete this.items[name]; this.scheduleSave(); }
  // Define diretamente o percentual para itens (0..100). Placeholders ficam com o restante.
  updateItemChancePercent(p){ this.meta.itemChancePercent = clamp(p,0,100); this.scheduleSave(); }

  // Fornece pesos efetivos (derivados) usados no spin: retorna { wItem, wNone }
  derivedWeights(){
    // Estratégia simples: atribui peso base 1 por segmento, multiplicado pela proporção global.
    // Para manter sem frações extremas, usamos 100 como base comum.
    const pct = this.meta.itemChancePercent ?? 50;
    const wItem = pct;           // soma total desejada para itens
    const wNone = 100 - pct;     // soma total desejada para placeholders
    return { wItem, wNone };
  }
}
