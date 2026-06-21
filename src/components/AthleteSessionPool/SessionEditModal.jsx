import { useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../ui'
import SessionEditor from '../SessionEditor'
import {
  ACTIVITY_TAGS,
  WORKOUT_TYPES,
  getAllowedIntensityZones,
  normalizeIntensityZones,
} from '../../utils'
import { getSessionDomain } from '../../sessionBlocks'

export default function SessionEditModal({ session, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...session }))

  // Strength sessions are sets/reps/load based and have no aerobic intensity
  // zone, so the picker is hidden for them — matching WorkoutForm.
  const isStrength = getSessionDomain(draft.activityTag) === 'strength'
  const allowedZones = getAllowedIntensityZones(draft.type)

  function patch(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function toggleIntensityZone(zone) {
    const currentZones = normalizeIntensityZones(draft.type, draft.intensityZone)
    const nextZones = currentZones.includes(zone)
      ? (currentZones.length > 1 ? currentZones.filter(currentZone => currentZone !== zone) : currentZones)
      : [...currentZones, zone].sort((a, b) => a - b)
    patch('intensityZone', nextZones)
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Edit session"
      title={draft.title || 'New session'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </>
      }
    >
      <div className="th-pool-edit">
        <div className="th-pool-edit-grid">
          <Field label="Title">
            <Input value={draft.title || ''} onChange={e => patch('title', e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={draft.type || ''} onChange={e => patch('type', e.target.value)}>
              {WORKOUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Activity">
            <Select value={draft.activityTag || ''} onChange={e => patch('activityTag', e.target.value)}>
              <option value="">Select activity</option>
              {ACTIVITY_TAGS.map(tag => (
                <option key={tag.value} value={tag.value}>{tag.label}</option>
              ))}
            </Select>
          </Field>
        </div>

        {!isStrength && (
          <Field label="Intensity zone" hint="Select one or more zones">
            <div className="zone-picker">
              {allowedZones.map(z => (
                <button
                  key={z}
                  type="button"
                  className={`th-zone-btn th-zone-${z}${normalizeIntensityZones(draft.type, draft.intensityZone).includes(z) ? ' is-active' : ''}`}
                  onClick={() => toggleIntensityZone(z)}
                >
                  Zone {z}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Description">
          <Textarea
            rows={2}
            value={draft.description || ''}
            onChange={e => patch('description', e.target.value)}
          />
        </Field>

        <SessionEditor
          value={draft.blocks}
          activityTag={draft.activityTag}
          workoutType={draft.type === 'interval' || draft.type === 'terskel' ? 'interval' : 'continuous'}
          onChange={(blocks) => patch('blocks', blocks)}
        />

        <Field label="Notes">
          <Textarea
            rows={2}
            value={draft.notes || ''}
            onChange={e => patch('notes', e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
