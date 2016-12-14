const loadTestModule = require('./lib/loadTestModule')
const chalk = require('chalk')
const co = require('co')
const args = require('minimist')(process.argv.slice(2))
const createTestIterator = require('./lib/createTestIterator')
const walkSteps = require('./lib/walkSteps')
const prettyFormatStep = require('./lib/prettyFormatStep')
const path = require('path')

const testModulePath = require('fs').realpathSync(args._[0])
console.log(chalk.bold.magenta('# prescript'), 'v' + require('./package').version)
console.log()

const dev = args.d || args['dev']

function runTest (test) {
  return co(function * () {
    const state = { }
    const tester = createTestIterator()
    const errors = [ ]
    tester.setTest(test)
    tester.begin()
    while (!tester.isDone()) {
      runNext(tester, state, (e) => errors.push(e))
    }
    if (errors.length > 0) {
      throw new Error('Test failed.')
    }
  })
}

function runDevelopmentMode () {
  const state = { }
  const tester = createTestIterator()

  function loadTest () {
    clearModuleCache()
    console.log(chalk.bold.yellow('## Loading test and generating test plan...'))
    const testModule = require(testModulePath)
    const test = loadTestModule(testModule)
    tester.setTest(test)
    console.log(chalk.dim('* ') + chalk.green('Test plan generated successfully.'))
    console.log()
  }

  function clearModuleCache () {
    const keysToRemove = Object.keys(require.cache).filter(shouldRemove)
    console.log(chalk.bold.yellow('## Clearing Node module cache...'))
    for (const key of keysToRemove) {
      console.log(chalk.dim('*'), 'Reloading', chalk.cyan(key))
      delete require.cache[key]
    }
    console.log()

    function shouldRemove (filePath) {
      const components = filePath.split(path.sep)
      return !components.includes('node_modules') &&
        !path.relative(process.cwd(), filePath).startsWith('..')
    }
  }

  loadTest()
  tester.begin()

  console.log(chalk.bold.cyan('Welcome to prescript development mode.'))
  console.log('Type help for more information.')
  console.log()

  const vorpal = require('vorpal')()

  vorpal.command('inspect')
  .alias('i')
  .description('Inspect the test state')
  .action(function (args, callback) {
    console.log('This is current test state:')
    console.log(require('util').inspect(state))
    callback()
  })

  vorpal.command('status')
  .alias('s')
  .description('Show the test status')
  .action(function (args, callback) {
    console.log('This is the test plan with current test status:')
    const currentStepNumber = tester.getCurrentStepNumber()
    walkSteps(tester.getTest(), (step) => {
      const prefix = (step.number === currentStepNumber
        ? chalk.bold.yellow('<*>')
        : '   '
      )
      console.log(prefix, prettyFormatStep(step))
    })
    console.log()
    if (currentStepNumber) {
      console.log('* Use the', chalk.cyan('continue'), 'command to execute until error.')
      console.log('* Use the', chalk.cyan('next'), 'command to execute the next step.')
    } else {
      console.log('')
    }
    console.log()
    callback()
  })

  vorpal.command('reload')
  .alias('r')
  .description('Reload the test file')
  .action(function (args, callback) {
    loadTest()
    console.log()
    console.log('Test file is reloaded.')
    console.log()
    callback()
  })

  vorpal.command('continue')
  .alias('c')
  .description('Continue running the test until there is an error')
  .action(function (args, callback) {
    co(function * () {
      while (!tester.isDone()) {
        let error
        yield * runNext(tester, state, (e) => { error = e })
        if (error) {
          break
        }
      }
    }).then(() => callback(), (err) => callback(err))
  })

  vorpal.command('next')
  .alias('n')
  .description('Run the next step.')
  .action(function (args, callback) {
    co(function * () {
      yield * runNext(tester, state, () => { })
    }).then(() => callback(), (err) => callback(err))
  })

  vorpal.delimiter('prescript>').show()
}

function * runNext (tester, state, onError) {
  const step = tester.getCurrentStep()
  process.stdout.write(chalk.dim('* ') + prettyFormatStep(step))
  try {
    yield step.action(state)
    console.log(chalk.bold.green(' OK'))
    tester.actionPassed()
  } catch (e) {
    console.log(chalk.bold.red(' ERROR'))
    console.log(chalk.red(e.stack))
    onError(e)
    tester.actionFailed()
  }
}

function runNonInteractiveMode () {
  const testModule = require(testModulePath)
  console.log(chalk.bold.yellow('## Generating test plan...'))
  const test = loadTestModule(testModule)
  console.log(chalk.dim('* ') + chalk.green('Test plan generated successfully.'))
  console.log()

  console.log(chalk.bold.yellow('## Running tests...'))
  runTest(test).catch((e) => setTimeout(() => { throw e }))
}

if (dev) {
  runDevelopmentMode()
} else {
  runNonInteractiveMode()
}
