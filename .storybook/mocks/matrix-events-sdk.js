export class NamespacedValue {
  constructor(name, altName) {
    this.name = name
    this.altName = altName
  }

  matches(value) {
    return value === this.name || value === this.altName
  }
}

export class UnstableValue extends NamespacedValue {
  constructor(name, altName) {
    super(name, altName)
  }
}

export const ExtensibleEvents = {
  parse() {
    return null
  }
}

export default {
  NamespacedValue,
  UnstableValue,
  ExtensibleEvents
}
