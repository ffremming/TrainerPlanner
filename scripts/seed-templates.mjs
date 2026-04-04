#!/usr/bin/env node
// Seed Firestore with predefined workout templates.
// Run: npm run seed-templates
// Requires Firebase Auth to be enabled and an admin account to exist.

import { createInterface } from 'readline'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDS-iDj7t9bgG1wBtld0KA4gtfCCxB6yI0',
  authDomain: 'trainingplanner-53081.firebaseapp.com',
  projectId: 'trainingplanner-53081',
  storageBucket: 'trainingplanner-53081.firebasestorage.app',
  messagingSenderId: '1012052493782',
  appId: '1:1012052493782:web:a854bcc28cfd54bfa51077',
}

const TEMPLATES = [
  // ─── Intervall ───
  {
    category: 'Intervall',
    type: 'interval',
    title: 'Rask intervall – 400m',
    description: '15 x 400 meter @ 12 km/t / 5:00 pace, 1 min pause',
    warmup: '2 km rolig oppvarming (opp: 2, ned: 1)',
    cooldown: '1 km nedkjøling',
    intensityZone: 5,
    notes: 'Aktfokus: rask intervallakt',
  },
  {
    category: 'Intervall',
    type: 'interval',
    title: 'Utholdenhet intervall – 1000m',
    description: '5 x 1000m @ 10 km/t / 6:00 pace, 1 min pause',
    warmup: '2 km rolig oppvarming',
    cooldown: '1 km nedkjøling',
    intensityZone: 4,
    notes: 'Aktfokus: utholdenhet intervallakt',
  },
  {
    category: 'Intervall',
    type: 'interval',
    title: '45/15 – 3x10',
    description: '45/15 3x10: starte på 11 km/t, øke med 0.1 for hvert andre drag',
    warmup: '2 km rolig oppvarming',
    intensityZone: 5,
    notes: '1 min: 10 x 1 min @ 13 km/t, 3 min pause',
  },
  {
    category: 'Intervall',
    type: 'interval',
    title: '200m sprint',
    description: '15 x 200 meter @ start på 13 km/t, kan øke deretter',
    warmup: '2 km rolig oppvarming',
    intensityZone: 5,
  },
  // ─── Terskel ───
  {
    category: 'Terskel',
    type: 'terskel',
    title: 'Terskel – 4x1km',
    description: '4 x 1km @ 11.5 km/t / 5:15 pace, 2 min pause',
    warmup: 'opp: 2, ned: 1, tot: 7',
    intensityZone: 4,
  },
  {
    category: 'Terskel',
    type: 'terskel',
    title: 'Terskel – 3x2km',
    description: '3x2 km @ 9.5–10.5 km/t / 6:00 pace, 2 min pause',
    intensityZone: 4,
  },
  {
    category: 'Terskel',
    type: 'terskel',
    title: 'Terskel – 4x2km',
    description: '4 x 2 km @ 9–10 km/t, 2 min pause',
    intensityZone: 4,
  },
  // ─── Rolig ───
  {
    category: 'Rolig',
    type: 'rolig',
    title: 'Rolig jogg',
    description: 'Rolig jogg, sone 1–2',
    intensityZone: 2,
  },
  {
    category: 'Rolig',
    type: 'rolig',
    title: 'Rolig løp – 6km',
    description: 'Sone 1–2 rolig 6 km',
    intensityZone: 2,
  },
  {
    category: 'Rolig',
    type: 'rolig',
    title: 'Kontinuerlig – mølle',
    description: '30 min kontinuerlig. Starte på 9 km/t, øke gradvis. Start i lav sone 3, avslutte i lav/moderat sone 4.',
    intensityZone: 3,
  },
  // ─── Mølle + styrke ───
  {
    category: 'Mølle + styrke',
    type: 'molle',
    title: 'Mølle + styrke (fullkropp)',
    description: '30 min gå mølle motbakke + styrke (fullkropp)',
    intensityZone: 2,
    notes: 'Leg extension 8–12x3 · Nedtrekk 8x3 · Knebøy 8x3 · Hip trust 8x3 · Ryggøv 8x3 · Mage 8x3',
  },
  // ─── Styrke ───
  {
    category: 'Styrke',
    type: 'styrke',
    title: 'Styrke – overkropp',
    description: 'Nedtrekk (apparat) 8x3\nBrystpress (apparat) 8x3\nSittende roing (apparat) 3x8\nSkulderpress 3x8\nTricep extension (apparat) 3x8',
    intensityZone: 2,
  },
  {
    category: 'Styrke',
    type: 'styrke',
    title: 'Styrke – bein',
    description: 'Leg extension 8–12x3\nSittende leg curl 8x3\nMarkløft 8x3\nHip trust 8x3\nTå hev 8x3',
    intensityZone: 2,
  },
  {
    category: 'Styrke',
    type: 'styrke',
    title: 'Styrke – fullkropp A',
    description: 'Knebøy 8x3\nMarkløft 8x3\nLeg extension 8–12x3\nSittende leg curl 8x3\nHip thrust 8x3\nNedtrekk (apparat) 8x3\nBrystpress (apparat) 8x3\nSkulderpress 3x8\nSittende roing (apparat) 3x8\nTricep extension (apparat) 3x8\nMage 8x3\nRygghev 8x3',
    intensityZone: 2,
  },
  {
    category: 'Styrke',
    type: 'styrke',
    title: 'Styrke – fullkropp B',
    description: 'Knebøy 8x3\nRumensk markløft 8x3\nUtfall 8x3 per bein\nSittende leg curl 8x3\nNedtrekk (apparat) 8x3\nBrystpress (apparat) 8x3\nSittende roing (apparat) 8x3\nSkulderpress 3x8\nBicep curl 3x8\nPlanke 3 sett\nRygghev 8x3',
    intensityZone: 2,
  },
  {
    category: 'Styrke',
    type: 'styrke',
    title: 'Styrke – fullkropp C',
    description: 'Hip thrust 8x3\nMarkløft 8x3\nLeg extension 8–12x3\nSittende leg curl 8x3\nNedtrekk (apparat) 8x3\nBrystpress (apparat) 8x3\nSittende roing (apparat) 8x3\nSidehev 3x10\nTricep extension (apparat) 3x8\nMage 8x3\nRygghev 8x3',
    intensityZone: 2,
  },
]

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = q => new Promise(resolve => rl.question(q, resolve))

async function main() {
  console.log('\n🌱 Seed øktmaler til Firestore\n')
  const email = await ask('Admin e-post: ')
  const password = await ask('Passord: ')
  rl.close()

  const app = initializeApp(firebaseConfig)
  const authInstance = getAuth(app)
  const db = getFirestore(app)

  try {
    await signInWithEmailAndPassword(authInstance, email, password)
    console.log('✓ Logget inn')
  } catch (err) {
    console.error('❌ Innlogging feilet:', err.message)
    process.exit(1)
  }

  const existingSnap = await getDocs(collection(db, 'templates'))
  if (!existingSnap.empty) {
    const ans = await ask(`\n⚠️  Det finnes allerede ${existingSnap.size} maler. Legg til uansett? (j/N): `)
    if (ans.toLowerCase() !== 'j') {
      console.log('Avbrutt.')
      process.exit(0)
    }
  }

  console.log(`\nLegger til ${TEMPLATES.length} maler...`)
  for (const t of TEMPLATES) {
    await addDoc(collection(db, 'templates'), { ...t, createdAt: serverTimestamp() })
    process.stdout.write('.')
  }
  console.log(`\n\n✅ ${TEMPLATES.length} maler lagt til i Firestore!`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
