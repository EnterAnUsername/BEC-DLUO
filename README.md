# Cave — Suivi DLUO

Appli web pour suivre les DLUO de la cave à bière : ajout simple ou groupé (livraison), filtres, masquage, suppression.

## 1. Créer les tables sur Supabase

Dans ton projet Supabase → **SQL Editor** → colle et exécute ceci :

```sql
create table produits (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  style text,
  degre numeric,
  format text,
  rayon text,
  date_entree date,
  dluo date not null,
  quantite integer default 0,
  trie boolean default false,
  created_at timestamp with time zone default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('style','rayon','format')),
  value text not null,
  unique(type, value)
);

insert into categories (type, value) values
  ('rayon', 'Français'), ('rayon', 'Étranger'),
  ('format', 'CAN 33'), ('format', 'CAN 44'), ('format', 'BT 33'), ('format', 'BT 75'),
  ('style', 'Test Style 1'), ('style', 'Test Style 2');

-- Accès ouvert pour l'instant (outil interne, sans compte utilisateur).
-- À restreindre plus tard si besoin (authentification, etc.)
alter table produits enable row level security;
alter table categories enable row level security;

create policy "allow all produits" on produits for all using (true) with check (true);
create policy "allow all categories" on categories for all using (true) with check (true);
```

## 2. Récupérer les clés Supabase

Dans ton projet Supabase → **Project Settings → API** :
- `Project URL` → sera `VITE_SUPABASE_URL`
- `anon public` key → sera `VITE_SUPABASE_ANON_KEY`

## 3. Tester en local (optionnel)

```bash
npm install
cp .env.example .env
# remplis .env avec tes clés
npm run dev
```

## 4. Déployer sur Netlify

1. Pousse ce projet sur ton repo GitHub (`git add . && git commit -m "init" && git push`)
2. Sur Netlify : **Add new site → Import an existing project** → choisis le repo GitHub
3. Build command : `npm run build` / Publish directory : `dist` (déjà configuré dans `netlify.toml`, Netlify devrait les détecter automatiquement)
4. Avant de déployer (ou juste après) : **Site configuration → Environment variables**, ajoute :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Déclenche un déploiement (ou push un commit) → l'appli est en ligne

## Structure du projet

```
├── index.html
├── src/
│   ├── main.jsx          → point d'entrée React
│   ├── App.jsx            → toute l'appli (Accueil, Cave, formulaire, filtres...)
│   ├── supabaseClient.js  → connexion à Supabase
│   └── index.css          → styles + Tailwind
├── netlify.toml            → config de déploiement Netlify
├── .env.example             → variables à copier dans .env (local uniquement)
└── package.json
```

## Prochaine étape : scan des BL

Le bouton "Scanner un BL" est présent mais désactivé — on le branchera à une API de reconnaissance d'image une fois le reste stabilisé.
