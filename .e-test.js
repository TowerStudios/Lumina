const electron = require('electron')
console.log('typeof app:', typeof electron.app)
console.log('keys:', Object.keys(electron).slice(0,8).join(','))
console.log('versions.electron:', process.versions.electron)
