const fs = require('fs')
const path = require('path')

const fontPath = path.join(
  __dirname,
  '../src/lib/fonts/Cairo-Regular.ttf'
)

const font = fs.readFileSync(fontPath)

const base64 = font.toString('base64')

fs.writeFileSync(
  path.join(__dirname, '../src/lib/fonts/cairo-font.js'),
  `export const cairoFont = '${base64}'`
)

console.log('DONE')