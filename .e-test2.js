console.log('process.type:', process.type)
console.log('versions.electron:', process.versions.electron)
const e = require('electron')
console.log('require(electron) is string?', typeof e === 'string')
console.log('try require("electron") via builtin...')
try { console.log('app via process:', typeof process) } catch(err){ console.log('err', err.message) }
// look for the real electron api location
try {
  const real = require('module').builtinModules
  console.log('has electron builtin:', real.includes('electron'))
} catch(err){ console.log('builtinModules err', err.message) }
