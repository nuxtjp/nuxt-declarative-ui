import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const output = path.join(root, 'dist')
// dist is owned generated output; replace it so deleted source cannot survive packaging.
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('build/output/symlink')
fs.rmSync(output, {recursive:true,force:true})
execFileSync('vue-tsc', ['--project','tsconfig.build.json'], {cwd:root,stdio:'inherit'})
for (const file of fs.readdirSync(path.join(root,'src'), {recursive:true})) {
  const source = path.join(root,'src',file)
  if (!fs.statSync(source).isFile()) continue
  if (file.endsWith('.d.ts')) continue
  const target = path.join(output, file.replace(/\.ts$/u, '.js'))
  fs.mkdirSync(path.dirname(target), {recursive:true})
  if (file.endsWith('.ts')) fs.writeFileSync(target, ts.transpileModule(fs.readFileSync(source,'utf8'), {
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},fileName:file,
  }).outputText)
  else fs.copyFileSync(source,target)
}
