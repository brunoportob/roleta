import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
// Tentativa de carregar better-sqlite3 de forma opcional.
let Database = null;
try {
  // usar require para evitar que o empacotador quebre se o módulo não existir
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  Database = require('better-sqlite3');
} catch (e) {
  console.warn('[DB] better-sqlite3 não disponível, usando fallback arquivo texto. Motivo:', e.message);
}

// --- Persistência ---
let db; // instancia better-sqlite3
let DB_PATH; // caminho final
const LEGACY_FILE = path.join(process.cwd(), 'itens.txt');

function openDatabase(){
  if(!Database) return; // sem sqlite disponível
  try {
    const userDir = app.getPath('userData');
    DB_PATH = path.join(userDir, 'roleta.db');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`create table if not exists meta (
      id integer primary key check (id=1),
      item_chance_percent integer not null default 50
    );`);
    db.exec(`insert or ignore into meta(id, item_chance_percent) values (1,50);`);
    db.exec(`create table if not exists items (
      name text primary key,
      quantity integer not null
    );`);
    console.log('[DB] aberto em', DB_PATH);
  } catch(e){
    console.warn('[DB] Erro iniciando sqlite, fallback arquivo. Motivo:', e.message);
    db = null;
  }
}

function migrateFromLegacyIfNeeded(){
  try {
    if(!fs.existsSync(LEGACY_FILE)) return; // nada para migrar
    const count = db.prepare('select count(*) as c from items').get().c;
    if(count>0) return; // já tem dados, não migrar
    const raw = fs.readFileSync(LEGACY_FILE,'utf-8').trim();
    if(!raw){
      fs.renameSync(LEGACY_FILE, LEGACY_FILE+'.bak');
      console.log('[MIGRATION] itens.txt vazio -> renomeado para .bak');
      return;
    }
    const items = {};
    let icp = 50, probItem=100, probNone=100, legacyProb=null;
    raw.split(/\r?\n/).forEach(line=>{
      const t=line.trim(); if(!t) return;
      if(t.startsWith('#itemChancePercent=')){ const v=parseInt(t.split('=')[1]); if(!isNaN(v)) icp=v; return; }
      if(t.startsWith('#probItem=')){ const v=parseInt(t.split('=')[1]); if(!isNaN(v)) probItem=v; return; }
      if(t.startsWith('#probNone=')){ const v=parseInt(t.split('=')[1]); if(!isNaN(v)) probNone=v; return; }
      if(t.startsWith('#prob=')){ const v=parseInt(t.split('=')[1]); if(!isNaN(v)) legacyProb=v; return; }
      if(!t.includes(':')) return;
      const [n,qStr]=t.split(':'); const q=parseInt((qStr||'').trim());
      if(n.trim()&&!isNaN(q)&&q>=0) items[n.trim()]=q;
    });
    if(legacyProb!==null){ icp = legacyProb; }
    else { icp = Math.round((probItem)/(probItem+probNone)*100); }
    const insertItem = db.prepare('insert into items(name, quantity) values (?,?)');
    const tx = db.transaction(()=>{
      db.prepare('update meta set item_chance_percent=? where id=1').run(icp);
      Object.entries(items).forEach(([n,q])=>insertItem.run(n,q));
    });
    tx();
    fs.renameSync(LEGACY_FILE, LEGACY_FILE+'.bak');
    console.log('[MIGRATION] itens.txt migrado para SQLite e renomeado para .bak');
  } catch(e){ console.warn('[MIGRATION] falhou', e); }
}

function readFromDb(){
  if(!db) return { meta:{ itemChancePercent:50 }, items:{} };
  const metaRow = db.prepare('select item_chance_percent from meta where id=1').get();
  const rows = db.prepare('select name, quantity from items').all();
  const items = {}; rows.forEach(r=>{ items[r.name]=r.quantity; });
  return { meta: { itemChancePercent: metaRow?.item_chance_percent ?? 50 }, items };
}

function writeToDb(payload){
  if(!db) throw new Error('DB não inicializado');
  const { items: incomingItems, meta } = payload;
  const icp = (meta && typeof meta.itemChancePercent==='number') ? Math.min(100,Math.max(0,meta.itemChancePercent)) : 50;
  const getExisting = db.prepare('select name from items');
  const delStmt = db.prepare('delete from items where name=?');
  const upsertStmt = db.prepare('insert into items(name, quantity) values (?,?) on conflict(name) do update set quantity=excluded.quantity');
  const tx = db.transaction(()=>{
    db.prepare('update meta set item_chance_percent=? where id=1').run(icp);
    const existing = new Set(getExisting.all().map(r=>r.name));
    const incomingSet = new Set(Object.keys(incomingItems));
    // remove ausentes
    existing.forEach(name=>{ if(!incomingSet.has(name)) delStmt.run(name); });
    // upsert
    Object.entries(incomingItems).forEach(([n,q])=>{ if(typeof q==='number' && q>=0 && n.trim()) upsertStmt.run(n,q); });
  });
  tx();
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(process.cwd(), 'src', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  await win.loadFile('index.html');
}

app.whenReady().then(() => {
  try { openDatabase(); migrateFromLegacyIfNeeded(); } catch(e){ console.warn('[DB] fallback arquivo. Erro abrir SQLite:', e.message); }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('items:read', () => {
  try {
    if(db){ return { ok:true, ...readFromDb() }; }
    // fallback legado
    const legacy = fs.existsSync(LEGACY_FILE) ? fs.readFileSync(LEGACY_FILE,'utf-8') : '';
    if(!legacy) return { ok:true, meta:{ itemChancePercent:50 }, items:{} };
    // parse simples legado (reuso parcial)
    const items = {}; let icp=50;
    legacy.split(/\r?\n/).forEach(line=>{ const t=line.trim(); if(!t) return; if(t.startsWith('#itemChancePercent=')){ const v=parseInt(t.split('=')[1]); if(!isNaN(v)) icp=v; return; } if(t.includes(':')){ const [n,qStr]=t.split(':'); const q=parseInt((qStr||'').trim()); if(n.trim()&&!isNaN(q)&&q>=0) items[n.trim()]=q; } });
    return { ok:true, meta:{ itemChancePercent:icp }, items };
  } catch(e){ return { ok:false, error:e.message }; }
});

ipcMain.handle('items:write', (_evt, payload) => {
  try {
    if(db){ writeToDb(payload); return { ok:true }; }
    // fallback arquivo legado
    const lines = [`#itemChancePercent=${payload.meta?.itemChancePercent ?? 50}`];
    Object.entries(payload.items||{}).forEach(([n,q])=>{ if(typeof q==='number'&&q>=0&&n.trim()) lines.push(`${n}:${q}`); });
    fs.writeFileSync(LEGACY_FILE, lines.join('\n'),'utf-8');
    return { ok:true };
  } catch(e){ return { ok:false, error:e.message }; }
});
