import {
  BarChart3,
  Bike,
  ClipboardList,
  Dumbbell,
  Footprints,
  Gauge,
  PersonStanding,
  Waves,
} from 'lucide-react'

const ICONS = {
  run: PersonStanding,
  walking: Footprints,
  strength: Dumbbell,
  xc_skiing: Gauge,
  bike: Bike,
  swim: Waves,
  interval: BarChart3,
  terskel: Gauge,
  rolig: PersonStanding,
  molle: Dumbbell,
  annet: ClipboardList,
}

export default function ActivityIcon({ name, className = '', title, strokeWidth = 1.9 }) {
  const Icon = ICONS[name] || ICONS.annet

  return <Icon aria-hidden={title ? undefined : 'true'} aria-label={title} className={className} strokeWidth={strokeWidth} />
}
