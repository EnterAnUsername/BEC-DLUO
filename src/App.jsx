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
export default App;
