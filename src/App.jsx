import React, { useState, useMemo, useEffect } from 'react';
import {
  Home, Beer, Camera, Search, ChevronDown, ChevronRight, Check, Eye, EyeOff, Plus, Trash2,
  AlertCircle, ListPlus, X, Loader2, Pencil, ArrowUpDown, FlaskConical, Upload, Layers, Archive, FileUp,
} from 'lucide-react';
import { supabase } from './supabaseClient';

const EMPTY_ROW = { nom: '', style: '', degre: '', format: '', rayon: '', lot: '', distributeur: '', date_entree: '', dluo: '', quantite: '', trie: false, garde: false };

function daysLeft(dluo) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dluo);
  return Math.round((target - today) / 86400000);
}

function statusOf(dluo) {
  const d = daysLeft(dluo);
  if (d < 0) return 'expire';
  if (d <= 7) return 'j7';
  if (d <= 15) return 'j15';
  if (d <= 30) return 'j30';
  return 'ok';
}

const STATUS_META = {
  expire: { label: 'Expiré', color: '#8B2E1E' },
  j7: { label: 'J-7', color: '#C1502E' },
  j15: { label: 'J-15', color: '#D9722E' },
  j30: { label: 'J-30', color: '#D9A628' },
  ok: { label: 'OK', color: '#7A9B5E' },
};

// The most urgent status among several lots, used for grouped rows (ignores "garde" lots).
const STATUS_ORDER = ['expire', 'j7', 'j15', 'j30', 'ok'];
function worstStatus(items) {
  const relevant = items.filter((it) => !it.garde);
  if (relevant.length === 0) return 'ok';
  let idx = STATUS_ORDER.length - 1;
  for (const it of relevant) idx = Math.min(idx, STATUS_ORDER.indexOf(statusOf(it.dluo)));
  return STATUS_ORDER[idx];
}

function normalizeName(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function CapBadge({ status, garde }) {
  if (garde) {
    return (
      <span title="Bière de garde — DLUO non surveillée" style={{ display: 'inline-flex', color: '#8B7355' }}>
        <Archive size={14} />
      </span>
    );
  }
  const color = STATUS_META[status].color;
  return (
    <span
      title={STATUS_META[status].label}
      style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: `2px dashed ${color}`, boxShadow: `inset 0 0 0 3px ${color}33`, flexShrink: 0 }}
    />
  );
}

function DluoDisplay({ dluo, garde }) {
  if (garde) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono">{dluo}</span>
        <span className="px-1.5 py-0.5 rounded text-xs whitespace-nowrap flex items-center gap-1" style={{ background: '#8B735530', color: '#8B7355' }}>
          <Archive size={10} /> Garde
        </span>
      </div>
    );
  }
  const d = daysLeft(dluo);
  const status = statusOf(dluo);
  const color = STATUS_META[status].color;
  const label = d < 0 ? `Expiré ${Math.abs(d)}j` : `J-${d}`;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono">{dluo}</span>
      <span className="px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap" style={{ background: `${color}30`, color }}>{label}</span>
    </div>
  );
}

function SimpleSelect({ label, value, onChange, options, onAddOption, onRemoveOption }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function confirmAdd() {
    const v = draft.trim();
    if (v) {
      if (!options.includes(v)) onAddOption(v);
      onChange(v);
    }
    setDraft('');
    setAdding(false);
  }

  return (
    <div className="text-xs" style={{ color: '#A69884' }}>
      {label && <div className="mb-1">{label}</div>}
      {!adding ? (
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-2.5 py-2.5 pr-7 rounded text-sm"
              style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8', appearance: 'none' }}
            >
              <option value="">— choisir —</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" color="#A69884" />
          </div>
          <button type="button" onClick={() => setAdding(true)} title="Ajouter une catégorie" className="px-2.5 rounded" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#D98F2B' }}>
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={() => value && onRemoveOption(value)}
            disabled={!value}
            title="Supprimer la catégorie sélectionnée"
            className="px-2.5 rounded"
            style={{ background: '#241F1A', border: '1px solid #3A332B', color: value ? '#C1502E' : '#4A443C', cursor: value ? 'pointer' : 'not-allowed' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd(); } }}
            placeholder="Nouvelle catégorie..."
            className="flex-1 px-2.5 py-2.5 rounded text-sm"
            style={{ background: '#241F1A', border: '1px solid #D98F2B', color: '#F3E9D8' }}
          />
          <button type="button" onClick={confirmAdd} className="px-3 rounded" style={{ background: '#D98F2B', color: '#1B1815' }}>
            <Check size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function NavTabs({ view, setView, aTrier, urgentCount, testMode, setTestMode }) {
  const tabs = [
    { id: 'accueil', label: 'Accueil', icon: Home },
    { id: 'cave', label: 'Cave', icon: Beer },
  ];
  return (
    <nav className="flex items-center justify-between px-5 md:px-10 pt-5">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t"
              style={{ background: active ? '#241F1A' : 'transparent', color: active ? '#F3E9D8' : '#A69884', border: active ? '1px solid #3A332B' : '1px solid transparent', borderBottom: active ? '1px solid #241F1A' : '1px solid transparent', marginBottom: -1 }}
            >
              <Icon size={16} />
              {t.label}
              {t.id === 'cave' && aTrier > 0 && (
                <span title="Non traitées" className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-mono" style={{ background: '#D9A628', color: '#1B1815' }}>{aTrier}</span>
              )}
              {t.id === 'cave' && urgentCount > 0 && (
                <span title="DLUO à J-30 ou moins" className="px-1.5 py-0.5 rounded-full text-xs font-mono" style={{ background: '#C1502E', color: '#F3E9D8' }}>{urgentCount}</span>
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setTestMode((v) => !v)}
        title="Mode test : les données ne touchent pas le vrai stock"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium mb-1"
        style={{ background: testMode ? '#D98F2B' : '#241F1A', color: testMode ? '#1B1815' : '#6B645A', border: '1px solid #3A332B' }}
      >
        <FlaskConical size={12} /> Test
      </button>
    </nav>
  );
}

function SingleAddForm({ form, setForm, onAdd, saving, confirmed, formError, catProps, editing, onCancelEdit }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="text-xs" style={{ color: '#A69884' }}>
        Nom
        <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} />
      </label>

      <SimpleSelect label="Style" value={form.style} onChange={(v) => setForm({ ...form, style: v })} options={catProps.styleOptions} onAddOption={catProps.addStyleOption} onRemoveOption={catProps.removeStyleOption} />

      <label className="text-xs" style={{ color: '#A69884' }}>
        Degré (%)
        <input type="number" step="0.1" value={form.degre} onChange={(e) => setForm({ ...form, degre: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} />
      </label>

      <SimpleSelect label="Format" value={form.format} onChange={(v) => setForm({ ...form, format: v })} options={catProps.formatOptions} onAddOption={catProps.addFormatOption} onRemoveOption={catProps.removeFormatOption} />

      <SimpleSelect label="Pays d'origine / Rayon" value={form.rayon} onChange={(v) => setForm({ ...form, rayon: v })} options={catProps.rayonOptions} onAddOption={catProps.addRayonOption} onRemoveOption={catProps.removeRayonOption} />

      <label className="text-xs" style={{ color: '#A69884' }}>
        Numéro de lot
        <input type="text" value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} />
      </label>

      <SimpleSelect label="Distributeur" value={form.distributeur} onChange={(v) => setForm({ ...form, distributeur: v })} options={catProps.distributeurOptions} onAddOption={catProps.addDistributeurOption} onRemoveOption={catProps.removeDistributeurOption} />

      <label className="text-xs" style={{ color: '#A69884' }}>
        Date d'entrée
        <input type="date" value={form.date_entree} onChange={(e) => setForm({ ...form, date_entree: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} />
      </label>

      <label className="text-xs" style={{ color: '#A69884' }}>
        DLUO
        <input type="date" value={form.dluo} onChange={(e) => setForm({ ...form, dluo: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} />
      </label>

      <label className="text-xs" style={{ color: '#A69884' }}>
        Quantité
        <input type="number" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} />
      </label>

      <label className="flex items-center gap-2 text-sm sm:col-span-2 -mt-1" style={{ color: '#A69884' }}>
        <input type="checkbox" checked={form.garde} onChange={(e) => setForm({ ...form, garde: e.target.checked })} style={{ accentColor: '#8B7355' }} />
        <Archive size={14} /> Bière de garde — ne pas surveiller la DLUO
      </label>

      <div className="sm:col-span-2 flex items-center gap-3 mt-2 flex-wrap">
        <button type="button" onClick={onAdd} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium" style={{ background: '#D98F2B', color: '#1B1815', opacity: saving ? 0.7 : 1 }}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {editing ? 'Enregistrer les modifications' : 'Ajouter à la Cave'}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} className="px-4 py-2.5 rounded text-sm font-medium" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#A69884' }}>
            Annuler
          </button>
        )}
        {confirmed && <span className="flex items-center gap-1 text-sm" style={{ color: '#7A9B5E' }}><Check size={15} /> {editing ? 'Modifié' : 'Ajouté'}</span>}
        {formError && <span className="flex items-center gap-1 text-sm" style={{ color: '#C1502E' }}><AlertCircle size={15} /> {formError}</span>}
      </div>
      <p className="text-xs sm:col-span-2" style={{ color: '#6B645A' }}>
        Note : si le nom, le style et le format sont identiques à une fiche existante mais avec un lot différent, la Cave regroupera les deux automatiquement.
      </p>
    </div>
  );
}

function BulkAddForm({ rows, setRows, onSubmitBulk, saving, confirmedCount, catProps }) {
  function updateRow(i, key, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function addRow() { setRows((prev) => [...prev, { ...EMPTY_ROW }]); }
  function removeRow(i) { setRows((prev) => prev.filter((_, idx) => idx !== i)); }

  return (
    <div>
      <div className="overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0">
        <table className="text-sm" style={{ borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead>
            <tr style={{ color: '#A69884', textAlign: 'left' }}>
              <th className="pb-2 pr-2 font-medium">Nom</th>
              <th className="pb-2 pr-2 font-medium">Style</th>
              <th className="pb-2 pr-2 font-medium">Degré</th>
              <th className="pb-2 pr-2 font-medium">Format</th>
              <th className="pb-2 pr-2 font-medium">Rayon</th>
              <th className="pb-2 pr-2 font-medium">Lot</th>
              <th className="pb-2 pr-2 font-medium">Distrib.</th>
              <th className="pb-2 pr-2 font-medium">Entrée</th>
              <th className="pb-2 pr-2 font-medium">DLUO</th>
              <th className="pb-2 pr-2 font-medium">Qté</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid #2D2822' }}>
                <td className="py-1.5 pr-2"><input value={r.nom} onChange={(e) => updateRow(i, 'nom', e.target.value)} className="w-32 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} /></td>
                <td className="py-1.5 pr-2">
                  <select value={r.style} onChange={(e) => updateRow(i, 'style', e.target.value)} className="w-28 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }}>
                    <option value="">—</option>
                    {catProps.styleOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className="py-1.5 pr-2"><input type="number" step="0.1" value={r.degre} onChange={(e) => updateRow(i, 'degre', e.target.value)} className="w-16 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} /></td>
                <td className="py-1.5 pr-2">
                  <select value={r.format} onChange={(e) => updateRow(i, 'format', e.target.value)} className="w-24 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }}>
                    <option value="">—</option>
                    {catProps.formatOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <select value={r.rayon} onChange={(e) => updateRow(i, 'rayon', e.target.value)} className="w-24 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }}>
                    <option value="">—</option>
                    {catProps.rayonOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className="py-1.5 pr-2"><input value={r.lot} onChange={(e) => updateRow(i, 'lot', e.target.value)} className="w-20 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} /></td>
                <td className="py-1.5 pr-2">
                  <select value={r.distributeur} onChange={(e) => updateRow(i, 'distributeur', e.target.value)} className="w-24 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }}>
                    <option value="">—</option>
                    {catProps.distributeurOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className="py-1.5 pr-2"><input type="date" value={r.date_entree} onChange={(e) => updateRow(i, 'date_entree', e.target.value)} className="w-32 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} /></td>
                <td className="py-1.5 pr-2"><input type="date" value={r.dluo} onChange={(e) => updateRow(i, 'dluo', e.target.value)} className="w-32 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} /></td>
                <td className="py-1.5 pr-2"><input type="number" value={r.quantite} onChange={(e) => updateRow(i, 'quantite', e.target.value)} className="w-16 px-2 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8' }} /></td>
                <td className="py-1.5"><button type="button" onClick={() => removeRow(i)} title="Supprimer la ligne" style={{ color: '#6B645A' }}><X size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button type="button" onClick={addRow} className="flex items-center gap-2 px-4 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#D98F2B' }}>
          <Plus size={14} /> Ajouter une ligne
        </button>
        <button type="button" onClick={onSubmitBulk} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium" style={{ background: '#D98F2B', color: '#1B1815', opacity: saving ? 0.7 : 1 }}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          Ajouter toutes ces bières à la Cave
        </button>
        {confirmedCount > 0 && <span className="flex items-center gap-1 text-sm" style={{ color: '#7A9B5E' }}><Check size={15} /> {confirmedCount} ajoutée(s)</span>}
      </div>
      <p className="text-xs mt-3" style={{ color: '#6B645A' }}>Seules les lignes avec au moins un Nom et une DLUO seront ajoutées.</p>
    </div>
  );
}

function AccueilView(props) {
  const { mode, setMode, editing } = props;
  return (
    <div className="px-5 md:px-10 py-8" style={{ maxWidth: mode === 'bulk' ? 'none' : 640 }}>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="font-display text-2xl md:text-3xl">
          {editing ? 'Modifier une référence' : mode === 'single' ? 'Ajouter une référence' : 'Ajout groupé (livraison)'}
        </h1>
        {!editing && (
          <div className="flex gap-2">
            <button onClick={() => setMode(mode === 'single' ? 'bulk' : 'single')} className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#D98F2B' }}>
              <ListPlus size={14} /> {mode === 'single' ? 'Mode livraison' : 'Mode simple'}
            </button>
            <button disabled title="Bientôt disponible" className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium cursor-not-allowed" style={{ background: '#241F1A', color: '#6B645A', border: '1px solid #3A332B' }}>
              <Camera size={14} /> Scanner un BL
            </button>
          </div>
        )}
      </div>
      <p className="text-sm mb-6" style={{ color: '#A69884' }}>
        {editing ? 'Modifie les champs puis enregistre.' : mode === 'single' ? "Renseigne les infos ci-dessous, elles arrivent directement dans la Cave." : 'Remplis une ligne par bière reçue, puis envoie tout en une fois.'}
      </p>
      {mode === 'single' || editing ? (
        <SingleAddForm form={props.form} setForm={props.setForm} onAdd={props.onAdd} saving={props.saving} confirmed={props.confirmed} formError={props.formError} catProps={props.catProps} editing={editing} onCancelEdit={props.onCancelEdit} />
      ) : (
        <BulkAddForm rows={props.bulkRows} setRows={props.setBulkRows} onSubmitBulk={props.onSubmitBulk} saving={props.saving} confirmedCount={props.confirmedCount} catProps={props.catProps} />
      )}
    </div>
  );
}

/* ---------- Import de relevé de ventes (mouvements de stock) ---------- */

// Parses lines like:
// "360 MOINETTE BLONDE 33CL 1,41 0,000 0,00 -7,000 0,00 3,000 0,000 9,00 7,50 3,27 0,00 %"
// Header order after the name: PMPA, Entrée, Val.Entree, Stock, Val.Stock, Vendu, CA TTC, CA HT, Marge, Ecoulement, Rentabilité, %
// "Vendu" is therefore the 6th numeric token after the name (index 5).
function parseSalesReport(text) {
  const lines = text.split('\n');
  const rows = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const tokens = line.split(/\s+/);
    if (tokens.length < 8) continue;
    if (!/^\d+$/.test(tokens[0])) continue;
    const nameEndIdx = tokens.findIndex((t, idx) => idx > 0 && /^-?\d+[,.]\d{2,3}$/.test(t));
    if (nameEndIdx < 2) continue;
    const name = tokens.slice(1, nameEndIdx).join(' ');
    const rest = tokens.slice(nameEndIdx);
    if (rest.length < 6) continue;
    const vendu = parseFloat((rest[5] || '0').replace(',', '.'));
    const qty = Math.round(vendu || 0);
    if (qty <= 0) continue;
    rows.push({ nom: name, quantite_vendue: qty });
  }
  return rows;
}

function ImportPanel({ products, applyMovements, onClose }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileName, setFileName] = useState('');

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileError('');
    setFileName(file.name);
    setExtracting(true);
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist/build/pdf');
        const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.js?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let full = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          let lastY = null;
          for (const item of content.items) {
            const y = item.transform[5];
            if (lastY !== null && Math.abs(y - lastY) > 2) full += '\n';
            else if (lastY !== null) full += ' ';
            full += item.str;
            lastY = y;
          }
          full += '\n';
        }
        setText(full);
      } else {
        const t = await file.text();
        setText(t);
      }
    } catch (err) {
      setFileError("Impossible de lire ce fichier : " + err.message);
    }
    setExtracting(false);
  }

  function analyze() {
    const parsed = parseSalesReport(text);
    const rows = parsed.map((row) => {
      const matches = products.filter((p) => normalizeName(p.nom) === normalizeName(row.nom));
      return { ...row, include: matches.length > 0, matchCount: matches.length, totalStock: matches.reduce((s, m) => s + (m.quantite || 0), 0) };
    });
    setPreview(rows);
    setResult(null);
  }

  function updateRow(i, key, value) {
    setPreview((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  async function apply() {
    const toApply = preview.filter((r) => r.include && r.quantite_vendue > 0);
    if (toApply.length === 0) return;
    setApplying(true);
    // FIFO by soonest DLUO first across matching lots for each name.
    const updates = [];
    for (const row of toApply) {
      let remaining = row.quantite_vendue;
      const lots = products
        .filter((p) => normalizeName(p.nom) === normalizeName(row.nom))
        .sort((a, b) => daysLeft(a.dluo) - daysLeft(b.dluo));
      for (const lot of lots) {
        if (remaining <= 0) break;
        const current = lot.quantite || 0;
        const take = Math.min(current, remaining);
        if (take > 0) {
          updates.push({ id: lot.id, newQuantite: current - take });
          remaining -= take;
        }
      }
    }
    const res = await applyMovements(updates);
    setApplying(false);
    setResult({ count: updates.length, unmatched: preview.filter((r) => !r.include).length, error: res?.error });
  }

  return (
    <div className="mx-5 md:mx-10 my-4 p-4 rounded" style={{ background: '#241F1A', border: '1px solid #3A332B' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg flex items-center gap-2"><Upload size={16} /> Importer un relevé de ventes</h3>
        <button onClick={onClose} title="Fermer"><X size={16} color="#A69884" /></button>
      </div>
      <p className="text-xs mb-3" style={{ color: '#6B645A' }}>
        Colle le texte du relevé (export de ta caisse). La lecture est automatique mais reste à vérifier avant de valider — les noms doivent correspondre exactement à ceux de la Cave.
      </p>

      {!preview ? (
        <>
          <label className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium cursor-pointer w-fit" style={{ background: '#D98F2B', color: '#1B1815' }}>
            {extracting ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
            {extracting ? 'Lecture du fichier...' : fileName ? `Fichier : ${fileName}` : 'Choisir un fichier (PDF, CSV, TXT)'}
            <input type="file" accept=".pdf,.txt,.csv" onChange={handleFile} disabled={extracting} className="hidden" />
          </label>
          {fileError && <p className="text-xs mt-2" style={{ color: '#C1502E' }}>{fileError}</p>}
          <p className="text-xs my-2" style={{ color: '#6B645A' }}>— ou colle le texte directement —</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Colle ici le contenu du relevé..."
            className="w-full px-3 py-2 rounded text-xs font-mono"
            style={{ background: '#1B1815', border: '1px solid #3A332B', color: '#F3E9D8' }}
          />
          <button onClick={analyze} disabled={!text.trim()} className="mt-3 px-4 py-2 rounded text-sm font-medium" style={{ background: '#D98F2B', color: '#1B1815', opacity: text.trim() ? 1 : 0.5 }}>
            Analyser
          </button>
        </>
      ) : (
        <>
          {preview.length === 0 ? (
            <p className="text-sm" style={{ color: '#A69884' }}>Aucune ligne avec des ventes détectée dans ce texte.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#A69884', textAlign: 'left' }}>
                    <th className="pb-2 pr-2 font-medium"></th>
                    <th className="pb-2 pr-2 font-medium">Nom détecté</th>
                    <th className="pb-2 pr-2 font-medium">Qté vendue</th>
                    <th className="pb-2 pr-2 font-medium">Correspondance</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #2D2822', opacity: r.include ? 1 : 0.5 }}>
                      <td className="py-1.5 pr-2">
                        <input type="checkbox" checked={r.include} disabled={r.matchCount === 0} onChange={(e) => updateRow(i, 'include', e.target.checked)} style={{ accentColor: '#D98F2B' }} />
                      </td>
                      <td className="py-1.5 pr-2">{r.nom}</td>
                      <td className="py-1.5 pr-2">
                        <input type="number" value={r.quantite_vendue} onChange={(e) => updateRow(i, 'quantite_vendue', parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 rounded text-sm" style={{ background: '#1B1815', border: '1px solid #3A332B', color: '#F3E9D8' }} />
                      </td>
                      <td className="py-1.5 pr-2 text-xs">
                        {r.matchCount === 0 ? (
                          <span style={{ color: '#C1502E' }}>Aucune fiche trouvée</span>
                        ) : (
                          <span style={{ color: '#7A9B5E' }}>{r.matchCount} lot(s) · stock actuel {r.totalStock}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button onClick={() => setPreview(null)} className="px-4 py-2 rounded text-sm" style={{ background: '#1B1815', border: '1px solid #3A332B', color: '#A69884' }}>Recommencer</button>
            {preview.length > 0 && (
              <button onClick={apply} disabled={applying} className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium" style={{ background: '#D98F2B', color: '#1B1815', opacity: applying ? 0.7 : 1 }}>
                {applying && <Loader2 size={14} className="animate-spin" />}
                Appliquer les mouvements
              </button>
            )}
          </div>
          {result && (
            <p className="text-sm mt-3" style={{ color: result.error ? '#C1502E' : '#7A9B5E' }}>
              {result.error ? `Erreur : ${result.error}` : `${result.count} lot(s) mis à jour. ${result.unmatched} ligne(s) ignorée(s) (pas de correspondance).`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Cave ---------- */

const SORT_OPTIONS = {
  dluo_asc: { label: 'DLUO croissante', fn: (a, b) => daysLeft(a.dluo) - daysLeft(b.dluo) },
  dluo_desc: { label: 'DLUO décroissante', fn: (a, b) => daysLeft(b.dluo) - daysLeft(a.dluo) },
  alpha: { label: 'Alphabétique', fn: (a, b) => a.nom.localeCompare(b.nom) },
  style: { label: 'Par style', fn: (a, b) => (a.style || '').localeCompare(b.style || '') },
  rayon: { label: 'Par rayon', fn: (a, b) => (a.rayon || '').localeCompare(b.rayon || '') || a.nom.localeCompare(b.nom) },
};

function ProductRow({ p, selected, toggleSelect, toggleTrie, onEdit, deleteProduct, indent }) {
  return (
    <tr className="row-enter" style={{ borderTop: '1px solid #2D2822', opacity: p.trie ? 0.5 : 1 }}>
      <td className="py-3 pr-2"><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} style={{ accentColor: '#D98F2B' }} /></td>
      <td className="py-3"><CapBadge status={statusOf(p.dluo)} garde={p.garde} /></td>
      <td className="py-3 font-medium" style={{ paddingLeft: indent ? 20 : 0 }}>{indent ? '↳ ' : ''}{p.nom}</td>
      <td className="py-3" style={{ color: '#A69884' }}>{p.style}</td>
      <td className="py-3 font-mono">{p.degre}%</td>
      <td className="py-3" style={{ color: '#A69884' }}>{p.format}</td>
      <td className="py-3" style={{ color: '#A69884' }}>{p.rayon}</td>
      <td className="py-3 font-mono" style={{ color: '#A69884' }}>{p.lot}</td>
      <td className="py-3" style={{ color: '#A69884' }}>{p.distributeur}</td>
      <td className="py-3"><DluoDisplay dluo={p.dluo} garde={p.garde} /></td>
      <td className="py-3 font-mono">{p.quantite}</td>
      <td className="py-3 text-center">
        <button onClick={() => toggleTrie(p.id)} title={p.trie ? 'Remettre en rayon' : 'Marquer comme fait (masquer)'} className="p-1.5 rounded inline-flex" style={{ background: p.trie ? '#7A9B5E' : '#241F1A', border: '1px solid #3A332B', color: p.trie ? '#1B1815' : '#6B645A' }}>
          <Check size={13} />
        </button>
      </td>
      <td className="py-3 text-right">
        <button onClick={() => onEdit(p)} title="Modifier cette fiche" className="p-1.5 rounded" style={{ color: '#D98F2B' }}><Pencil size={14} /></button>
      </td>
      <td className="py-3 text-right">
        <button onClick={() => deleteProduct(p.id)} title="Supprimer définitivement" className="p-1.5 rounded" style={{ color: '#C1502E' }}><Trash2 size={14} /></button>
      </td>
    </tr>
  );
}

function ProductCard({ p, selected, toggleSelect, toggleTrie, onEdit, deleteProduct, indent }) {
  return (
    <div className="row-enter p-4 rounded" style={{ background: '#241F1A', border: '1px solid #3A332B', opacity: p.trie ? 0.5 : 1, marginLeft: indent ? 14 : 0 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} style={{ accentColor: '#D98F2B' }} />
          <CapBadge status={statusOf(p.dluo)} garde={p.garde} />
          <span className="font-medium">{indent ? '↳ ' : ''}{p.nom}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toggleTrie(p.id)} title={p.trie ? 'Remettre en rayon' : 'Marquer comme fait (masquer)'} className="p-1.5 rounded" style={{ background: p.trie ? '#7A9B5E' : '#241F1A', border: '1px solid #3A332B', color: p.trie ? '#1B1815' : '#6B645A' }}>
            <Check size={13} />
          </button>
          <button onClick={() => onEdit(p)} title="Modifier cette fiche" className="p-1.5 rounded" style={{ color: '#D98F2B' }}><Pencil size={14} /></button>
          <button onClick={() => deleteProduct(p.id)} title="Supprimer définitivement" className="p-1.5 rounded" style={{ color: '#C1502E' }}><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="mb-1.5"><DluoDisplay dluo={p.dluo} garde={p.garde} /></div>
      <div className="text-xs flex flex-wrap gap-x-3 gap-y-1" style={{ color: '#A69884' }}>
        <span>{p.style}</span>
        <span className="font-mono">{p.degre}%</span>
        <span>{p.format}</span>
        <span>{p.rayon}</span>
        {p.lot && <span className="font-mono">Lot {p.lot}</span>}
        {p.distributeur && <span>{p.distributeur}</span>}
        <span className="font-mono">Qté {p.quantite}</span>
      </div>
    </div>
  );
}

function CaveView({ products, toggleTrie, deleteProduct, deleteMany, maskMany, onEdit, applyMovements }) {
  const [search, setSearch] = useState('');
  const [styleFilter, setStyleFilter] = useState('Tous');
  const [rayonFilter, setRayonFilter] = useState('Tous');
  const [statutFilter, setStatutFilter] = useState('Tous');
  const [showMasked, setShowMasked] = useState(false);
  const [selected, setSelected] = useState([]);
  const [sortBy, setSortBy] = useState('dluo_asc');
  const [expanded, setExpanded] = useState([]);
  const [showImport, setShowImport] = useState(false);

  const styles = useMemo(() => ['Tous', ...new Set(products.map((p) => p.style).filter(Boolean))], [products]);
  const rayons = useMemo(() => ['Tous', ...new Set(products.map((p) => p.rayon).filter(Boolean))], [products]);
  const maskedCount = products.filter((p) => p.trie).length;

  const filtered = useMemo(() => {
    return products
      .filter((p) => showMasked || !p.trie)
      .filter((p) => p.nom.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => styleFilter === 'Tous' || p.style === styleFilter)
      .filter((p) => rayonFilter === 'Tous' || p.rayon === rayonFilter)
      .filter((p) => statutFilter === 'Tous' || statusOf(p.dluo) === statutFilter)
      .sort(SORT_OPTIONS[sortBy].fn);
  }, [products, search, styleFilter, rayonFilter, statutFilter, showMasked, sortBy]);

  // Group same name + style + format together (different lots of the same reference).
  const grouped = useMemo(() => {
    const seen = new Map();
    const order = [];
    for (const p of filtered) {
      const key = `${normalizeName(p.nom)}|${p.style || ''}|${p.format || ''}`;
      if (!seen.has(key)) {
        seen.set(key, []);
        order.push(key);
      }
      seen.get(key).push(p);
    }
    return order.map((key) => {
      const items = seen.get(key).sort((a, b) => daysLeft(a.dluo) - daysLeft(b.dluo));
      return { key, items, isGroup: items.length > 1 };
    });
  }, [filtered]);

  function toggleExpand(key) {
    setExpanded((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function toggleSelect(id) { setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  const allSelected = filtered.length > 0 && filtered.every((p) => selected.includes(p.id));
  function toggleSelectAll() {
    if (allSelected) setSelected((prev) => prev.filter((id) => !filtered.some((p) => p.id === id)));
    else setSelected((prev) => [...new Set([...prev, ...filtered.map((p) => p.id)])]);
  }
  function deleteSelected() { deleteMany(selected); setSelected([]); }
  function maskSelected() { maskMany(selected); setSelected([]); }

  return (
    <div>
      <div className="px-5 md:px-10 pt-6 pb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl md:text-3xl mb-1">La Cave</h1>
          <p className="text-sm" style={{ color: '#A69884' }}>{products.length} références au total · {maskedCount} masquées</p>
        </div>
        <button onClick={() => setShowImport((s) => !s)} className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#D98F2B' }}>
          <Upload size={14} /> Importer un relevé de ventes
        </button>
      </div>

      {showImport && <ImportPanel products={products} applyMovements={applyMovements} onClose={() => setShowImport(false)} />}

      <div className="px-5 md:px-10 py-3 flex flex-wrap gap-3 items-center" style={{ borderTop: '1px solid #3A332B', borderBottom: '1px solid #3A332B' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded flex-1 min-w-[180px]" style={{ background: '#241F1A', border: '1px solid #3A332B' }}>
          <Search size={15} color="#A69884" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une bière..." className="bg-transparent outline-none text-sm flex-1" style={{ color: '#F3E9D8' }} />
        </div>
        {[
          { value: styleFilter, setter: setStyleFilter, options: styles },
          { value: rayonFilter, setter: setRayonFilter, options: rayons },
          { value: statutFilter, setter: setStatutFilter, options: ['Tous', 'expire', 'j7', 'j15', 'j30', 'ok'] },
        ].map((f, i) => (
          <div key={i} className="relative">
            <select value={f.value} onChange={(e) => f.setter(e.target.value)} className="px-3 py-2 pr-8 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8', appearance: 'none' }}>
              {f.options.map((o) => (<option key={o} value={o}>{o === 'Tous' ? 'Tous' : STATUS_META[o] ? STATUS_META[o].label : o}</option>))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" color="#A69884" />
          </div>
        ))}
        <div className="relative">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="pl-8 pr-3 py-2 rounded text-sm" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#F3E9D8', appearance: 'none' }}>
            {Object.entries(SORT_OPTIONS).map(([key, o]) => <option key={key} value={key}>{o.label}</option>)}
          </select>
          <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" color="#A69884" />
        </div>
        <button onClick={() => setShowMasked((s) => !s)} className="flex items-center gap-2 px-3 py-2 rounded text-sm ml-auto" style={{ background: showMasked ? '#D98F2B' : '#241F1A', color: showMasked ? '#1B1815' : '#A69884', border: '1px solid #3A332B' }}>
          {showMasked ? <Eye size={15} /> : <EyeOff size={15} />}
          Masqués {showMasked ? 'affichés' : 'cachés'} ({maskedCount})
        </button>
      </div>

      {selected.length > 0 && (
        <div className="px-5 md:px-10 py-2 flex items-center gap-3 flex-wrap" style={{ background: '#2D1E19', borderBottom: '1px solid #3A332B' }}>
          <span className="text-sm" style={{ color: '#D98F2B' }}>{selected.length} sélectionnée(s)</span>
          <button onClick={maskSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs" style={{ background: '#7A9B5E', color: '#1B1815' }}><EyeOff size={12} /> Masquer la sélection</button>
          <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs" style={{ background: '#C1502E', color: '#F3E9D8' }}><Trash2 size={12} /> Supprimer la sélection</button>
          <button onClick={() => setSelected([])} className="text-xs" style={{ color: '#A69884' }}>Annuler</button>
        </div>
      )}

      {/* Table - desktop */}
      <div className="hidden md:block px-10 py-6">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#A69884', textAlign: 'left' }}>
              <th className="pb-3 pr-2"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ accentColor: '#D98F2B' }} /></th>
              <th className="pb-3 font-medium" style={{ width: 24 }}></th>
              <th className="pb-3 font-medium">Nom</th>
              <th className="pb-3 font-medium">Style</th>
              <th className="pb-3 font-medium font-mono">°</th>
              <th className="pb-3 font-medium">Format</th>
              <th className="pb-3 font-medium">Rayon</th>
              <th className="pb-3 font-medium">Lot</th>
              <th className="pb-3 font-medium">Distributeur</th>
              <th className="pb-3 font-medium font-mono">DLUO</th>
              <th className="pb-3 font-medium font-mono">Qté</th>
              <th className="pb-3 font-medium text-center">Fait</th>
              <th className="pb-3 font-medium"></th>
              <th className="pb-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              if (!g.isGroup) {
                const p = g.items[0];
                return <ProductRow key={p.id} p={p} selected={selected} toggleSelect={toggleSelect} toggleTrie={toggleTrie} onEdit={onEdit} deleteProduct={deleteProduct} />;
              }
              const isOpen = expanded.includes(g.key);
              const totalQty = g.items.reduce((s, p) => s + (p.quantite || 0), 0);
              const first = g.items[0];
              return (
                <React.Fragment key={g.key}>
                  <tr style={{ borderTop: '1px solid #2D2822', background: '#211C17' }}>
                    <td className="py-3 pr-2"></td>
                    <td className="py-3"><CapBadge status={worstStatus(g.items)} /></td>
                    <td className="py-3 font-medium">
                      <button onClick={() => toggleExpand(g.key)} className="flex items-center gap-1.5">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {first.nom}
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-mono" style={{ background: '#3A332B', color: '#D98F2B' }}>
                          <Layers size={10} /> {g.items.length} lots
                        </span>
                      </button>
                    </td>
                    <td className="py-3" style={{ color: '#A69884' }}>{first.style}</td>
                    <td className="py-3 font-mono">{first.degre}%</td>
                    <td className="py-3" style={{ color: '#A69884' }}>{first.format}</td>
                    <td className="py-3" style={{ color: '#A69884' }}>{first.rayon}</td>
                    <td className="py-3" style={{ color: '#6B645A' }}>—</td>
                    <td className="py-3" style={{ color: '#6B645A' }}>—</td>
                    <td className="py-3 text-xs" style={{ color: '#A69884' }}>prochaine : {first.dluo}</td>
                    <td className="py-3 font-mono">{totalQty}</td>
                    <td className="py-3"></td>
                    <td className="py-3"></td>
                    <td className="py-3"></td>
                  </tr>
                  {isOpen && g.items.map((p) => (
                    <ProductRow key={p.id} p={p} selected={selected} toggleSelect={toggleSelect} toggleTrie={toggleTrie} onEdit={onEdit} deleteProduct={deleteProduct} indent />
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center py-10" style={{ color: '#6B645A' }}>Aucune référence ne correspond à ces filtres.</p>}
      </div>

      {/* Cards - mobile */}
      <div className="md:hidden px-5 py-4 flex flex-col gap-3">
        {grouped.map((g) => {
          if (!g.isGroup) {
            const p = g.items[0];
            return <ProductCard key={p.id} p={p} selected={selected} toggleSelect={toggleSelect} toggleTrie={toggleTrie} onEdit={onEdit} deleteProduct={deleteProduct} />;
          }
          const isOpen = expanded.includes(g.key);
          const totalQty = g.items.reduce((s, p) => s + (p.quantite || 0), 0);
          const first = g.items[0];
          return (
            <div key={g.key} className="flex flex-col gap-2">
              <button onClick={() => toggleExpand(g.key)} className="p-4 rounded flex items-center justify-between text-left" style={{ background: '#211C17', border: '1px solid #3A332B' }}>
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <CapBadge status={worstStatus(g.items)} />
                  <span className="font-medium">{first.nom}</span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-mono" style={{ background: '#3A332B', color: '#D98F2B' }}>
                    <Layers size={10} /> {g.items.length}
                  </span>
                </div>
                <span className="font-mono text-sm">{totalQty}</span>
              </button>
              {isOpen && g.items.map((p) => (
                <ProductCard key={p.id} p={p} selected={selected} toggleSelect={toggleSelect} toggleTrie={toggleTrie} onEdit={onEdit} deleteProduct={deleteProduct} indent />
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center py-10" style={{ color: '#6B645A' }}>Aucune référence ne correspond à ces filtres.</p>}
      </div>
    </div>
  );
}

/* ---------- App ---------- */

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('accueil');
  const [mode, setMode] = useState('single');
  const [form, setForm] = useState({ ...EMPTY_ROW });
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState('');
  const [bulkRows, setBulkRows] = useState([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [styleOptions, setStyleOptions] = useState([]);
  const [rayonOptions, setRayonOptions] = useState([]);
  const [formatOptions, setFormatOptions] = useState([]);
  const [distributeurOptions, setDistributeurOptions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [testMode, setTestMode] = useState(false);

  const TBL = { produits: testMode ? 'produits_demo' : 'produits', categories: testMode ? 'categories_demo' : 'categories' };

  useEffect(() => { loadAll(); }, [testMode]);

  async function loadAll() {
    setLoading(true);
    setLoadError('');
    const [{ data: prod, error: prodErr }, { data: cats, error: catErr }] = await Promise.all([
      supabase.from(TBL.produits).select('*').order('dluo', { ascending: true }),
      supabase.from(TBL.categories).select('*'),
    ]);
    if (prodErr || catErr) {
      setLoadError((prodErr || catErr).message);
    } else {
      setProducts(prod || []);
      setStyleOptions((cats || []).filter((c) => c.type === 'style').map((c) => c.value));
      setRayonOptions((cats || []).filter((c) => c.type === 'rayon').map((c) => c.value));
      setFormatOptions((cats || []).filter((c) => c.type === 'format').map((c) => c.value));
      setDistributeurOptions((cats || []).filter((c) => c.type === 'distributeur').map((c) => c.value));
    }
    setLoading(false);
  }

  const aTrier = products.filter((p) => !p.trie).length;
  const urgentCount = products.filter((p) => !p.trie && !p.garde && daysLeft(p.dluo) <= 30).length;

  function cleanRow(r) {
    return {
      nom: r.nom,
      style: r.style || null,
      degre: r.degre ? parseFloat(r.degre) : null,
      format: r.format || null,
      rayon: r.rayon || null,
      lot: r.lot || null,
      distributeur: r.distributeur || null,
      date_entree: r.date_entree || null,
      dluo: r.dluo,
      quantite: r.quantite ? parseInt(r.quantite) : 0,
      trie: r.trie || false,
      garde: r.garde || false,
    };
  }

  function startEdit(p) {
    setForm({
      nom: p.nom || '', style: p.style || '', degre: p.degre ?? '', format: p.format || '',
      rayon: p.rayon || '', lot: p.lot || '', distributeur: p.distributeur || '',
      date_entree: p.date_entree || '', dluo: p.dluo || '', quantite: p.quantite ?? '', trie: p.trie || false, garde: p.garde || false,
    });
    setEditingId(p.id);
    setMode('single');
    setFormError('');
    setView('accueil');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_ROW });
    setFormError('');
  }

  async function handleAdd() {
    if (!form.nom.trim() || !form.dluo) {
      setFormError('Merci de renseigner au moins le nom et la DLUO.');
      return;
    }
    setFormError('');
    setSaving(true);
    if (editingId) {
      const { data, error } = await supabase.from(TBL.produits).update(cleanRow(form)).eq('id', editingId).select();
      setSaving(false);
      if (error) { setFormError(error.message); return; }
      setProducts((prev) => prev.map((p) => (p.id === editingId ? data[0] : p)));
      setEditingId(null);
      setForm({ ...EMPTY_ROW });
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 2500);
      return;
    }
    const { data, error } = await supabase.from(TBL.produits).insert([cleanRow(form)]).select();
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    setProducts((prev) => [...prev, ...data]);
    setForm({ ...EMPTY_ROW });
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 2500);
  }

  async function handleSubmitBulk() {
    const valid = bulkRows.filter((r) => r.nom.trim() && r.dluo);
    if (valid.length === 0) return;
    setSaving(true);
    const { data, error } = await supabase.from(TBL.produits).insert(valid.map(cleanRow)).select();
    setSaving(false);
    if (error) { alert('Erreur : ' + error.message); return; }
    setProducts((prev) => [...prev, ...data]);
    setBulkRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
    setConfirmedCount(valid.length);
    setTimeout(() => setConfirmedCount(0), 3000);
  }

  async function toggleTrie(id) {
    const p = products.find((x) => x.id === id);
    const newVal = !p.trie;
    setProducts((prev) => prev.map((x) => (x.id === id ? { ...x, trie: newVal } : x)));
    const { error } = await supabase.from(TBL.produits).update({ trie: newVal }).eq('id', id);
    if (error) { alert('Erreur : ' + error.message); loadAll(); }
  }

  async function deleteProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from(TBL.produits).delete().eq('id', id);
    if (error) { alert('Erreur : ' + error.message); loadAll(); }
  }

  async function deleteMany(ids) {
    setProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
    const { error } = await supabase.from(TBL.produits).delete().in('id', ids);
    if (error) { alert('Erreur : ' + error.message); loadAll(); }
  }

  async function maskMany(ids) {
    setProducts((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, trie: true } : p)));
    const { error } = await supabase.from(TBL.produits).update({ trie: true }).in('id', ids);
    if (error) { alert('Erreur : ' + error.message); loadAll(); }
  }

  // Used by the sales-report import: apply a batch of { id, newQuantite } updates.
  async function applyMovements(updates) {
    if (!updates || updates.length === 0) return {};
    setProducts((prev) => prev.map((p) => {
      const u = updates.find((x) => x.id === p.id);
      return u ? { ...p, quantite: u.newQuantite } : p;
    }));
    for (const u of updates) {
      const { error } = await supabase.from(TBL.produits).update({ quantite: u.newQuantite }).eq('id', u.id);
      if (error) { loadAll(); return { error: error.message }; }
    }
    return {};
  }

  async function addCategory(type, value, setter) {
    setter((prev) => [...prev, value]);
    const { error } = await supabase.from(TBL.categories).insert([{ type, value }]);
    if (error) { alert('Erreur : ' + error.message); loadAll(); }
  }
  async function removeCategory(type, value, setter) {
    setter((prev) => prev.filter((o) => o !== value));
    const { error } = await supabase.from(TBL.categories).delete().eq('type', type).eq('value', value);
    if (error) { alert('Erreur : ' + error.message); loadAll(); }
  }

  const catProps = {
    styleOptions,
    addStyleOption: (v) => addCategory('style', v, setStyleOptions),
    removeStyleOption: (v) => removeCategory('style', v, setStyleOptions),
    rayonOptions,
    addRayonOption: (v) => addCategory('rayon', v, setRayonOptions),
    removeRayonOption: (v) => removeCategory('rayon', v, setRayonOptions),
    formatOptions,
    addFormatOption: (v) => addCategory('format', v, setFormatOptions),
    removeFormatOption: (v) => removeCategory('format', v, setFormatOptions),
    distributeurOptions,
    addDistributeurOption: (v) => addCategory('distributeur', v, setDistributeurOptions),
    removeDistributeurOption: (v) => removeCategory('distributeur', v, setDistributeurOptions),
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1B1815', color: '#F3E9D8' }}>
      <NavTabs view={view} setView={setView} aTrier={aTrier} urgentCount={urgentCount} testMode={testMode} setTestMode={setTestMode} />
      {testMode && (
        <div className="mx-5 md:mx-10 mt-3 px-4 py-2 rounded flex items-center gap-2 text-sm font-medium" style={{ background: '#3A2A12', color: '#D98F2B', border: '1px solid #D98F2B' }}>
          <FlaskConical size={15} /> Mode test actif — ces données sont séparées du vrai stock.
        </div>
      )}
      {loadError && (
        <div className="mx-5 md:mx-10 mt-4 p-3 rounded flex items-center gap-2 text-sm" style={{ background: '#3A241F', color: '#E8A98C', border: '1px solid #8B2E1E' }}>
          <AlertCircle size={16} /> Impossible de charger les données : {loadError}. Vérifie les clés Supabase (variables d'environnement){testMode ? ' et que les tables _demo existent.' : '.'}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 px-5 md:px-10 py-10 text-sm" style={{ color: '#A69884' }}>
          <Loader2 size={16} className="animate-spin" /> Chargement...
        </div>
      ) : (
        <div style={{ borderBottom: '1px solid #3A332B' }}>
          {view === 'accueil' ? (
            <AccueilView
              mode={mode} setMode={setMode} form={form} setForm={setForm} onAdd={handleAdd}
              saving={saving} confirmed={confirmed} formError={formError}
              bulkRows={bulkRows} setBulkRows={setBulkRows} onSubmitBulk={handleSubmitBulk}
              confirmedCount={confirmedCount} catProps={catProps}
              editing={!!editingId} onCancelEdit={cancelEdit}
            />
          ) : (
            <CaveView products={products} toggleTrie={toggleTrie} deleteProduct={deleteProduct} deleteMany={deleteMany} maskMany={maskMany} onEdit={startEdit} applyMovements={applyMovements} />
          )}
        </div>
      )}
    </div>
  );
}
