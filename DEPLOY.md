# Deploy på Vercel (fungerer lokalt, 404 på Vercel)

## Endringer i prosjektet som hjelper på Vercel

- **package.json**: `engines.node": ">=20"` – Vercel bruker samme Node som lokalt.
- **next.config.ts**: `serverExternalPackages: ["sharp"]` – Sharp brukes riktig i serverless.

## Sjekkliste i Vercel-dashboardet

### 1. Root Directory (viktigst)

- **Vercel** → prosjektet → **Settings** → **General**
- **Root Directory**:  
  - Hvis GitHub-repoet **kun** er cropboard-appen (package.json i roten): la feltet stå **tomt**.  
  - Hvis cropboard ligger **i en undermappe** (f.eks. `min-repo/cropboard`): skriv inn mappen, f.eks. `cropboard`, og **Save**.
- **Redeploy** etter endring.

### 2. Framework Preset

- **Settings** → **General** → **Framework Preset** → velg **Next.js**.

### 3. Build & Development

- **Build Command**: `npm run build` (eller la stå tomt for standard).
- **Output Directory**: la stå tomt (Next.js-standard).
- **Install Command**: `npm install` (eller tomt).

### 4. Når du fortsatt får 404

- **Deployments** → velg siste deploy → sjekk at **Build** er grønn og fullført.
- Åpne **Production URL** (f.eks. `https://cropboard-xxx.vercel.app`) – ikke en gammel eller feil URL.
- **Functions** / **Runtime Logs**: se om det kommer feil når du laster siden eller bruker «Go cropping».

### 5. Lokal test før push

```bash
npm run build
npm start
```

Åpne http://localhost:3000 og http://localhost:3000/results – begge skal fungere.
