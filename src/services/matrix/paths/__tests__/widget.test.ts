import { describe, expect, it } from 'vitest'
import { WIDGET } from '../widget'

describe('WIDGET', () => {
  it('CAPABILITIES encodes roomId and widgetId', () => {
    expect(WIDGET.CAPABILITIES('!r:server', 'w1')).toBe('/rooms/!r%3Aserver/widgets/w1/capabilities')
  })

  it('SEND encodes roomId and widgetId', () => {
    expect(WIDGET.SEND('!r:server', 'w1')).toBe('/rooms/!r%3Aserver/widgets/w1/send')
  })
})
