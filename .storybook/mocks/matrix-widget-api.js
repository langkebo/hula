export class UnstableApiVersion { constructor(v) { this.version = v } }
export class NamespacedValue { constructor(name, altName) { this.name = name; this.altName = altName } }
export const MatrixCapabilities = { Screenshots: 'm.cap.screenshots', StickerMessages: 'm.cap.sticker_messages', AlwaysOnScreen: 'm.cap.always_on_screen', ModalWidgets: 'm.cap.modal_widgets', RequireClient: 'm.cap.require_client', Timeline: 'm.cap.timeline' }
export class WidgetApi {}
export class ClientWidgetApi extends WidgetApi {}
export class WidgetApiResponseError extends Error {}
export class WidgetApiToWidgetAction {}
export class WidgetApiFromWidgetAction {}

export default { UnstableApiVersion, MatrixCapabilities, WidgetApi, ClientWidgetApi, WidgetApiResponseError, WidgetApiToWidgetAction, WidgetApiFromWidgetAction }
