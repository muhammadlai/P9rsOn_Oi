import mitt from 'mitt'

type Events = {
  'start-listening': void
  'stop-listening': void
  'audio-ended': void
  'processing-complete': string
  'screenshot-ready': string
  'mute-playback-toggle': void
  'take-screenshot': void
  'cancel-tts': void
  'cancel-llm-stream': void
  /** Opens the ZARA camera overlay (vision capture). */
  'zara-open-camera': void
  /** Camera frame captured and ready for vision analysis. */
  'zara-camera-frame': { image: string; question: string }
  /** ZARA finished a turn — used to resume continuous listening. */
  'zara-turn-complete': void
}

const eventBus = mitt<Events>()

export default eventBus
