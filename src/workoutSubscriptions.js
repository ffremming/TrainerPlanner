import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { chunkArray, compareWorkoutsBySchedule, normalizeWorkout } from './utils'

function sortWorkouts(a, b) {
  if (a.year !== b.year) return a.year - b.year
  if (a.week !== b.week) return a.week - b.week
  return compareWorkoutsBySchedule(a, b)
}

export function subscribeToWorkoutWeeks({
  athleteId,
  weeks,
  onData,
  onError,
  filterWorkout,
}) {
  if (!athleteId || !Array.isArray(weeks) || weeks.length === 0) {
    onData([], true)
    return () => {}
  }

  const weeksByYear = weeks.reduce((acc, week) => {
    if (!acc.has(week.year)) {
      acc.set(week.year, new Set())
    }
    acc.get(week.year).add(week.week)
    return acc
  }, new Map())

  const queryStates = new Map()
  const workoutMap = new Map()

  const publish = () => {
    onData(
      [...workoutMap.values()]
        .map(({ queryKey, ...workout }) => workout)
        .sort(sortWorkouts),
      [...queryStates.values()].every(state => state)
    )
  }

  const unsubscribers = [...weeksByYear.entries()].flatMap(([year, weekNumbers]) => {
    return chunkArray([...weekNumbers], 10).map(weekChunk => {
      const queryKey = `${year}:${weekChunk.join(',')}`
      queryStates.set(queryKey, false)

      return onSnapshot(
        query(
          collection(db, 'workouts'),
          where('athleteId', '==', athleteId),
          where('year', '==', year),
          where('week', 'in', weekChunk)
        ),
        snap => {
          for (const [id, workout] of workoutMap.entries()) {
            if (workout.queryKey === queryKey) {
              workoutMap.delete(id)
            }
          }

          snap.docs.forEach(docSnap => {
            const normalized = normalizeWorkout({ id: docSnap.id, ...docSnap.data() })
            if (filterWorkout && !filterWorkout(normalized)) return
            workoutMap.set(normalized.id, { ...normalized, queryKey })
          })

          queryStates.set(queryKey, true)
          publish()
        },
        error => {
          queryStates.set(queryKey, true)
          publish()
          if (onError) onError(error)
        }
      )
    })
  })

  return () => unsubscribers.forEach(unsub => unsub())
}
