import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// itens.txt continua na raiz do projeto (process.cwd())
const DATA_FILE = path.join(process.cwd(), 'itens.txt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Servir arquivos estáticos a partir da raiz (onde está index.html)
app.use(express.static(process.cwd()));

function readItemsFile() {
  if (!fs.existsSync(DATA_FILE)) return { meta: { probItem:100, probNone:100 }, items: {} };
  const raw = fs.readFileSync(DATA_FILE, 'utf-8').trim();
  if (!raw) return { meta: { probItem:100, probNone:100 }, items: {} };
  const items = {};
  let probItem = 100, probNone = 100, legacyProb=null;
  raw.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#probItem=')) { const v=parseInt(trimmed.split('=')[1]); if(!isNaN(v)&&v>0) probItem=v; return; }
    if (trimmed.startsWith('#probNone=')) { const v=parseInt(trimmed.split('=')[1]); if(!isNaN(v)&&v>0) probNone=v; return; }
    if (trimmed.startsWith('#prob=')) { const v=parseInt(trimmed.split('=')[1]); if(!isNaN(v)&&v>0) legacyProb=v; return; }
    if (!trimmed.includes(':')) return;
    const [name, qty] = trimmed.split(':');
    const q = parseInt((qty || '').trim());
    if (name.trim() && !isNaN(q) && q >= 0) items[name.trim()] = q;
  });
  if(legacyProb!==null){ probItem = legacyProb; probNone = legacyProb; }
  return { meta: { probItem, probNone }, items };
}

function writeItemsFile(payload) {
  const { items: itemsObj, meta } = payload;
  const pi = meta && meta.probItem ? meta.probItem : 100;
  const pn = meta && meta.probNone ? meta.probNone : 100;
  const lines = [`#probItem=${pi}`, `#probNone=${pn}`];
  Object.entries(itemsObj).forEach(([name, q]) => { if (typeof q === 'number' && q >= 0 && name.trim()) lines.push(`${name}:${q}`); });
  fs.writeFileSync(DATA_FILE, lines.join('\n'), 'utf-8');
}

app.get('/api/items', (_req, res) => {
  try { res.json(readItemsFile()); }
  catch(e){ res.status(500).json({ error:'Erro ao ler arquivo', details:e.message }); }
});

app.put('/api/items', (req, res) => {
  try {
    const bodyItems = req.body.items || {};
    const meta = req.body.meta || { probItem:100, probNone:100 };
    const normalized = {};
    Object.keys(bodyItems).forEach(name => {
      const q = parseInt(bodyItems[name]);
      if (!isNaN(q) && q >= 0 && name.trim()) normalized[name.trim()] = q;
    });
    writeItemsFile({ items: normalized, meta });
    res.json({ success:true, items:normalized, meta });
  } catch(e){ res.status(500).json({ error:'Erro ao gravar arquivo', details:e.message }); }
});

app.listen(PORT, () => console.log(`Servidor iniciado em http://localhost:${PORT}`));
