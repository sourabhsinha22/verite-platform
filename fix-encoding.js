const fs = require('fs')
const path = require('path')

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  // Remove BOM
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
  const orig = content
  // Fix common mojibake sequences
  content = content.replace(/â€"/g, '—')   // em dash
  content = content.replace(/â€™/g, '’')   // right single quote
  content = content.replace(/â€˜/g, '‘')   // left single quote
  content = content.replace(/â€œ/g, '“')   // left double quote
  content = content.replace(/â€/g, '”')    // right double quote
  content = content.replace(/Ã©/g, 'é')    // é
  content = content.replace(/â†'/g, '→')   // →
  content = content.replace(/Â·/g, '·')    // middle dot
  content = content.replace(/Â/g, '')            // stray Â
  // After fixing, replace problematic Unicode in JSX with safe HTML entities or literals
  // Em dashes in JSX text nodes are fine, but in string literals use ASCII alternative
  if (content !== orig) {
    fs.writeFileSync(filePath, content, 'utf8')
    return true
  }
  return false
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let fixed = 0
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) fixed += walk(full)
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      if (fixFile(full)) {
        console.log('Fixed:', e.name)
        fixed++
      }
    }
  }
  return fixed
}

const total = walk(path.join(__dirname, 'src'))
console.log(`\nFixed ${total} files`)
