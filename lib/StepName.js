const chalk = require('chalk')
const invariant = require('invariant')

function parse (string) {
  const placeholders = [ ]
  const stringedParts = string.replace(/`([^`]+?)`/g, (a, x) => {
    placeholders.push(x)
    return '\0'
  })
  return new StepName(stringedParts.split('\0'), placeholders)
}

function coerce (stepNameOrString) {
  if (typeof stepNameOrString === 'string') {
    return parse(stepNameOrString)
  }
  if (typeof stepNameOrString === 'object' && stepNameOrString) {
    const stepName = stepNameOrString
    invariant(
      stepName.parts,
      'Expected step name object to have `parts` property'
    )
    invariant(
      stepName.placeholders,
      'Expected step name object to have `placeholders` property'
    )
    return stepName
  }
  invariant(false, 'Step name should be a string or a tagged `named` literal.')
}

function named (parts, ...placeholders) {
  return new StepName(parts, placeholders)
}

function format (stepName, { colors = true } = { }) {
  if (typeof stepName === 'string') {
    return stepName
  }
  const { parts, placeholders } = stepName
  const resultParts = [ ]
  for (let i = 0; i < parts.length; i++) {
    resultParts.push(parts[i])
    if (placeholders[i]) {
      resultParts.push(colors
        ? chalk.cyan(String(placeholders[i]))
        : `‘${placeholders[i]}’`
      )
    }
  }
  return resultParts.join('')
}

exports.named = named
exports.parse = parse
exports.coerce = coerce
exports.format = format

class StepName {
  constructor (parts, placeholders) {
    this.parts = parts
    this.placeholders = placeholders
  }
  toString () {
    return format(this, { colors: false })
  }
}