import EventEmitterDefault from 'node:events'

export const EventEmitter = EventEmitterDefault
export const once = EventEmitterDefault.once.bind(EventEmitterDefault)

export default EventEmitterDefault
