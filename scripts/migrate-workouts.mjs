#!/usr/bin/env node
// Migrates existing workouts to include an athleteId field.
// Run: node scripts/migrate-workouts.mjs <superadmin-uid>
//
// This assigns all existing workouts (that don't have an athleteId) to the
// specified user, typically the superadmin.

import { createInterface } from 'readline'

const API_KEY = 'AIzaSyDS-iDj7t9bgG1wBtld0KA4gtfCCxB6yI0'
const PROJECT_ID = 'trainingplanner-53081'
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = q => new Promise(resolve => rl.question(q, resolve))

async function main() {
  const athleteId = process.argv[2]

  if (!athleteId) {
    console.log('\n📋 Migrering av treningsøkter til flerbruker-system\n')
    console.log('Bruk: node scripts/migrate-workouts.mjs <superadmin-uid>\n')
    console.log('Du finner din UID i Firebase Console > Authentication > Users')
    console.log('Eller logg inn i appen først - den oppretter automatisk en superadmin-profil.')
    console.log('Deretter kan du finne UID i Firestore > users-samlingen.\n')
    process.exit(1)
  }

  console.log(`\n🔄 Migrerer treningsøkter til athleteId: ${athleteId}\n`)

  // Authenticate to get a token
  const email = await ask('Admin e-post: ')
  const password = await ask('Admin passord: ')
  rl.close()

  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  const authData = await authRes.json()
  if (authData.error) {
    console.error('❌ Autentiseringsfeil:', authData.error.message)
    process.exit(1)
  }

  const token = authData.idToken
  console.log('✅ Autentisert som', authData.email)

  // Fetch all workouts
  let allDocs = []
  let nextPageToken = null

  do {
    const url = new URL(`${FIRESTORE_URL}/workouts`)
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken)
    url.searchParams.set('pageSize', '300')

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()

    if (data.documents) {
      allDocs = allDocs.concat(data.documents)
    }
    nextPageToken = data.nextPageToken
  } while (nextPageToken)

  console.log(`📊 Fant ${allDocs.length} treningsøkter totalt`)

  // Filter to only those missing athleteId
  const toMigrate = allDocs.filter(doc => {
    const fields = doc.fields || {}
    return !fields.athleteId
  })

  console.log(`🔧 ${toMigrate.length} økter mangler athleteId`)

  if (toMigrate.length === 0) {
    console.log('✅ Alle økter har allerede athleteId. Ingen migrering nødvendig.')
    process.exit(0)
  }

  let migrated = 0
  let errors = 0

  for (const docData of toMigrate) {
    const docPath = docData.name
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=athleteId`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              ...docData.fields,
              athleteId: { stringValue: athleteId },
            },
          }),
        }
      )

      if (res.ok) {
        migrated++
        if (migrated % 50 === 0) {
          console.log(`  ...migrert ${migrated}/${toMigrate.length}`)
        }
      } else {
        const errData = await res.json()
        console.error(`  ❌ Feil for ${docPath}:`, errData.error?.message)
        errors++
      }
    } catch (err) {
      console.error(`  ❌ Nettverksfeil for ${docPath}:`, err.message)
      errors++
    }
  }

  console.log(`\n✅ Migrering fullført!`)
  console.log(`   Migrert: ${migrated}`)
  if (errors > 0) console.log(`   Feil: ${errors}`)
}

main().catch(console.error)
