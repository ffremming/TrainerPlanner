import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'

const TEST_CATEGORIES = [
  {
    value: 'styrke',
    label: 'Styrke',
    description: '1RM, 3RM, hopp, repetisjoner eller tekniske tester.',
  },
  {
    value: 'utholdenhet',
    label: 'Utholdenhet',
    description: 'Terskel, VO2, distanse, tid eller pulsbaserte tester.',
  },
]

const EMPTY_FORM = {
  category: 'styrke',
  title: '',
  protocol: '',
  metric: '',
  baseline: '',
  target: '',
  scheduledDate: '',
  notes: '',
}

function sortTests(a, b) {
  const dateA = a.scheduledDate || ''
  const dateB = b.scheduledDate || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.title.localeCompare(b.title, 'no')
}

export default function TestingDashboard({ selectedAthleteId, athleteName, userProfile }) {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingTest, setEditingTest] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!selectedAthleteId) {
      setTests([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = onSnapshot(
      query(collection(db, 'tests'), where('athleteId', '==', selectedAthleteId)),
      snap => {
        const nextTests = snap.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .sort(sortTests)
        setTests(nextTests)
        setLoading(false)
      }
    )

    return unsub
  }, [selectedAthleteId])

  const groupedTests = useMemo(() => {
    return TEST_CATEGORIES.map(category => ({
      ...category,
      tests: tests.filter(test => test.category === category.value),
    }))
  }, [tests])

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function startCreate(category) {
    setEditingTest('new')
    setForm({ ...EMPTY_FORM, category })
  }

  function startEdit(test) {
    setEditingTest(test.id)
    setForm({
      category: test.category || 'styrke',
      title: test.title || '',
      protocol: test.protocol || '',
      metric: test.metric || '',
      baseline: test.baseline || '',
      target: test.target || '',
      scheduledDate: test.scheduledDate || '',
      notes: test.notes || '',
    })
  }

  function resetForm() {
    setEditingTest(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedAthleteId || !form.title.trim()) return

    const payload = {
      athleteId: selectedAthleteId,
      category: form.category,
      title: form.title.trim(),
      protocol: form.protocol.trim(),
      metric: form.metric.trim(),
      baseline: form.baseline.trim(),
      target: form.target.trim(),
      scheduledDate: form.scheduledDate || '',
      notes: form.notes.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: userProfile?.uid || null,
    }

    if (editingTest === 'new') {
      await addDoc(collection(db, 'tests'), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: userProfile?.uid || null,
      })
    } else {
      await updateDoc(doc(db, 'tests', editingTest), payload)
    }

    resetForm()
  }

  async function handleDelete(test) {
    if (!window.confirm(`Slett testen "${test.title}"?`)) return
    await deleteDoc(doc(db, 'tests', test.id))
    if (editingTest === test.id) {
      resetForm()
    }
  }

  return (
    <div className="testing-dashboard">
      <div className="testing-hero shell-card">
        <div>
          <span className="section-eyebrow">Testing</span>
          <h2 className="testing-title">Tester for {athleteName || 'valgt utøver'}</h2>
          <p className="testing-subtitle">
            Opprett og vedlikehold testprotokoller for styrke og utholdenhet.
          </p>
        </div>
        <div className="testing-hero-stats">
          <div className="testing-stat">
            <strong>{tests.length}</strong>
            <span>Totale tester</span>
          </div>
          <div className="testing-stat">
            <strong>{groupedTests.find(group => group.value === 'styrke')?.tests.length || 0}</strong>
            <span>Styrke</span>
          </div>
          <div className="testing-stat">
            <strong>{groupedTests.find(group => group.value === 'utholdenhet')?.tests.length || 0}</strong>
            <span>Utholdenhet</span>
          </div>
        </div>
      </div>

      <div className="testing-layout">
        <section className="testing-library">
          {loading ? (
            <div className="empty-state">Laster tester...</div>
          ) : (
            groupedTests.map(group => (
              <div key={group.value} className="testing-group shell-card">
                <div className="testing-group-header">
                  <div>
                    <h3>{group.label}</h3>
                    <p>{group.description}</p>
                  </div>
                  <button
                    type="button"
                    className="program-day-btn"
                    onClick={() => startCreate(group.value)}
                  >
                    Ny test
                  </button>
                </div>

                {group.tests.length === 0 ? (
                  <div className="testing-empty">
                    Ingen {group.label.toLowerCase()}-tester registrert ennå.
                  </div>
                ) : (
                  <div className="testing-list">
                    {group.tests.map(test => (
                      <article key={test.id} className="testing-card">
                        <div className="testing-card-top">
                          <div>
                            <span className={`testing-badge ${test.category}`}>{group.label}</span>
                            <h4>{test.title}</h4>
                          </div>
                          <div className="testing-card-actions">
                            <button type="button" className="admin-mini-btn" onClick={() => startEdit(test)}>
                              Rediger
                            </button>
                            <button type="button" className="admin-mini-btn danger" onClick={() => handleDelete(test)}>
                              Slett
                            </button>
                          </div>
                        </div>

                        <div className="testing-meta-grid">
                          <div>
                            <span>Protokoll</span>
                            <strong>{test.protocol || 'Ikke satt'}</strong>
                          </div>
                          <div>
                            <span>Målepunkt</span>
                            <strong>{test.metric || 'Ikke satt'}</strong>
                          </div>
                          <div>
                            <span>Siste resultat</span>
                            <strong>{test.baseline || 'Ikke satt'}</strong>
                          </div>
                          <div>
                            <span>Mål</span>
                            <strong>{test.target || 'Ikke satt'}</strong>
                          </div>
                          <div>
                            <span>Testdato</span>
                            <strong>{test.scheduledDate || 'Ikke planlagt'}</strong>
                          </div>
                        </div>

                        {test.notes && (
                          <p className="testing-notes">{test.notes}</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        <aside className="testing-editor shell-card">
          <div className="testing-editor-header">
            <div>
              <span className="section-eyebrow">Test Editor</span>
              <h3>{editingTest ? 'Rediger test' : 'Ny test'}</h3>
            </div>
            {editingTest && (
              <button type="button" className="admin-mini-btn" onClick={resetForm}>
                Nullstill
              </button>
            )}
          </div>

          <form className="testing-form" onSubmit={handleSubmit}>
            <label>
              Kategori
              <select value={form.category} onChange={event => updateField('category', event.target.value)}>
                {TEST_CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Navn på test
              <input
                type="text"
                value={form.title}
                onChange={event => updateField('title', event.target.value)}
                placeholder="F.eks. 5 km mølletest"
                required
              />
            </label>

            <label>
              Protokoll
              <textarea
                rows={3}
                value={form.protocol}
                onChange={event => updateField('protocol', event.target.value)}
                placeholder="Beskriv hvordan testen gjennomføres"
              />
            </label>

            <label>
              Målepunkt
              <input
                type="text"
                value={form.metric}
                onChange={event => updateField('metric', event.target.value)}
                placeholder="F.eks. Tid, watt, kg, repetisjoner"
              />
            </label>

            <div className="testing-form-grid">
              <label>
                Siste resultat
                <input
                  type="text"
                  value={form.baseline}
                  onChange={event => updateField('baseline', event.target.value)}
                  placeholder="F.eks. 21:42"
                />
              </label>

              <label>
                Mål
                <input
                  type="text"
                  value={form.target}
                  onChange={event => updateField('target', event.target.value)}
                  placeholder="F.eks. under 20:30"
                />
              </label>
            </div>

            <label>
              Planlagt dato
              <input
                type="date"
                value={form.scheduledDate}
                onChange={event => updateField('scheduledDate', event.target.value)}
              />
            </label>

            <label>
              Notater
              <textarea
                rows={4}
                value={form.notes}
                onChange={event => updateField('notes', event.target.value)}
                placeholder="Utstyr, standardisering, referanseverdier eller coach-notater"
              />
            </label>

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={resetForm}>
                Tøm
              </button>
              <button type="submit" className="btn-save">
                {editingTest === 'new' ? 'Opprett test' : 'Lagre endringer'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  )
}
