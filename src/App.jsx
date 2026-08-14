import React, { useState, useMemo, useEffect } from 'react';
import { Home, Beer, Camera, Search, ChevronDown, Check, Eye, EyeOff, Plus, Trash2, AlertCircle, ListPlus, X, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';

const EMPTY_ROW = { nom: '', style: '', degre: '', format: '', rayon: '', date_entree: '', dluo: '', quantite: '', trie: false };

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

function CapBadge({ status }) {
  const color = STATUS_META[status].color;
  return (
    <span
      title={STATUS_META[status].label}
      style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: `2px dashed ${color}`, boxShadow: `inset 0 0 0 3px ${color}33`, flexShrink: 0 }}
    />
  );
}

function DluoDisplay({ dluo }) {
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

function NavTabs({ view, setView, aTrier }) {
  const tabs = [
    { id: 'accueil', label: 'Accueil', icon: Home },
    { id: 'cave', label: 'Cave', icon: Beer },
  ];
  return (
    <nav className="flex gap-1 px-5 md:px-10 pt-5">
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
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-mono" style={{ background: '#D9A628', color: '#1B1815' }}>{aTrier}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SingleAddForm({ form, setForm, onAdd, saving, confirmed, formError, catProps }) {
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

      <div className="sm:col-span-2 flex items-center gap-3 mt-2">
        <button type="button" onClick={onAdd} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium" style={{ background: '#D98F2B', color: '#1B1815', opacity: saving ? 0.7 : 1 }}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          Ajouter à la Cave
        </button>
        {confirmed && <span className="flex items-center gap-1 text-sm" style={{ color: '#7A9B5E' }}><Check size={15} /> Ajouté</span>}
        {formError && <span className="flex items-center gap-1 text-sm" style={{ color: '#C1502E' }}><AlertCircle size={15} /> {formError}</span>}
      </div>
      <p className="text-xs sm:col-span-2" style={{ color: '#6B645A' }}>Enregistré directement dans la base — visible par toute l'équipe.</p>
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
        <table className="text-sm" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ color: '#A69884', textAlign: 'left' }}>
              <th className="pb-2 pr-2 font-medium">Nom</th>
              <th className="pb-2 pr-2 font-medium">Style</th>
              <th className="pb-2 pr-2 font-medium">Degré</th>
              <th className="pb-2 pr-2 font-medium">Format</th>
              <th className="pb-2 pr-2 font-medium">Rayon</th>
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
  const { mode, setMode } = props;
  return (
    <div className="px-5 md:px-10 py-8" style={{ maxWidth: mode === 'bulk' ? 'none' : 640 }}>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="font-display text-2xl md:text-3xl">{mode === 'single' ? 'Ajouter une référence' : 'Ajout groupé (livraison)'}</h1>
        <div className="flex gap-2">
          <button onClick={() => setMode(mode === 'single' ? 'bulk' : 'single')} className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium" style={{ background: '#241F1A', border: '1px solid #3A332B', color: '#D98F2B' }}>
            <ListPlus size={14} /> {mode === 'single' ? 'Mode livraison' : 'Mode simple'}
          </button>
          <button disabled title="Bientôt disponible" className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium cursor-not-allowed" style={{ background: '#241F1A', color: '#6B645A', border: '1px solid #3A332B' }}>
            <Camera size={14} /> Scanner un BL
          </button>
        </div>
      </div>
      <p className="text-sm mb-6" style={{ color: '#A69884' }}>
        {mode === 'single' ? "Renseigne les infos ci-dessous, elles arrivent directement dans la Cave." : 'Remplis une ligne par bière reçue, puis envoie tout en une fois.'}
      </p>
      {mode === 'single' ? (
        <SingleAddForm form={props.form} setForm={props.setForm} onAdd={props.onAdd} saving={props.saving} confirmed={props.confirmed} formError={props.formError} catProps={props.catProps} />
      ) : (
        <BulkAddForm rows={props.bulkRows} setRows={props.setBulkRows} onSubmitBulk={props.onSubmitBulk} saving={props.saving} confirmedCount={props.confirmedCount} catProps={props.catProps} />
      )}
    </div>
  );
}

function CaveView({ products, toggleTrie, deleteProduct, deleteMany, maskMany }) {
  const [search, setSearch] = useState('');
  const [styleFilter, setStyleFilter] = useState('Tous');
  const [rayonFilter, setRayonFilter] = useState('Tous');
  const [statutFilter, setStatutFilter] = useState('Tous');
  const [showMasked, setShowMasked] = useState(false);
  const [selected, setSelected] = useState([]);

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
      .sort((a, b) => daysLeft(a.dluo) - daysLeft(b.dluo));
  }, [products, search, styleFilter, rayonFilter, statutFilter, showMasked]);

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
      <div className="px-5 md:px-10 pt-6 pb-4">
        <h1 className="font-display text-2xl md:text-3xl mb-1">La Cave</h1>
        <p className="text-sm" style={{ color: '#A69884' }}>{products.length} références au total · {maskedCount} masquées</p>
      </div>

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
        <button onClick={() => setShowMasked((s) => !s)} className="flex items-center gap-2 px-3 py-2 rounded text-sm ml-auto" style={{ background: showMasked ? '#D98F2B' : '#241F1A', color: showMasked ? '#1B1815' : '#A69884', border: '1px solid #3A332B' }}>
          {showMasked ? <Eye size={15} /> : <EyeOff size={15} />}
          Masqués {showMasked ? 'affi
