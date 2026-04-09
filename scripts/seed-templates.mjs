#!/usr/bin/env node
// Seed Firestore with predefined workout templates.
// Run: npm run seed-templates
// Requires Firebase Auth to be enabled and an admin account to exist.

import { createInterface } from 'readline'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { WORKOUT_TEMPLATES } from '../src/workoutTemplates.js'
import {
  getDefaultCooldown,
  getDefaultWarmup,
  normalizeIntensityZones,
  normalizeLoadTag,
} from '../src/utils.js'

const firebaseConfig = {
  apiKey: 'AIzaSyDS-iDj7t9bgG1wBtld0KA4gtfCCxB6yI0',
  authDomain: 'trainingplanner-53081.firebaseapp.com',
  projectId: 'trainingplanner-53081',
  storageBucket: 'trainingplanner-53081.firebasestorage.app',
  messagingSenderId: '1012052493782',
  appId: '1:1012052493782:web:a854bcc28cfd54bfa51077',
}

const TEMPLATES = WORKOUT_TEMPLATES.map(template => {
  const { id, ...fields } = template

  return {
    ...fields,
    templateId: id,
    source: 'builtin',
    cooldown: fields.cooldown || getDefaultCooldown(fields.type, fields.activityTag),
    intensityZone: normalizeIntensityZones(fields.type, fields.intensityZone),
    loadTag: normalizeLoadTag(fields.type, fields.intensityZone, fields.loadTag),
    warmup: fields.warmup || getDefaultWarmup(fields.type, fields.activityTag),
  }
})

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = q => new Promise(resolve => rl.question(q, resolve))

async function main() {
  try {
    console.log('\n🌱 Seed øktmaler til Firestore\n')
    const email = await ask('Admin e-post: ')
    const password = await ask('Passord: ')

    const app = initializeApp(firebaseConfig)
    const authInstance = getAuth(app)
    const db = getFirestore(app)

    await signInWithEmailAndPassword(authInstance, email, password)
    console.log('✓ Logget inn')

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
  } catch (err) {
    console.error('❌ Seed feilet:', err.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
