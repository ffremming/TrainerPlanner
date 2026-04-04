#!/usr/bin/env node
// Run after enabling Firebase Auth in the console:
//   node scripts/create-admin.mjs

import { createInterface } from 'readline'

const API_KEY = 'AIzaSyDS-iDj7t9bgG1wBtld0KA4gtfCCxB6yI0'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = q => new Promise(resolve => rl.question(q, resolve))

async function main() {
  console.log('\n🔐 Opprett admin-bruker for Treningsplanner\n')
  const email = await ask('E-post: ')
  const password = await ask('Passord (min 6 tegn): ')
  rl.close()

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  const data = await res.json()

  if (data.error) {
    console.error('\n❌ Feil:', data.error.message)
    console.error('Sjekk at Email/Password er aktivert i Firebase Console.')
    process.exit(1)
  }

  console.log('\n✅ Admin-bruker opprettet!')
  console.log('   E-post:', data.email)
  console.log('\nLogg inn i appen med denne e-posten og passordet.')
}

main().catch(console.error)
