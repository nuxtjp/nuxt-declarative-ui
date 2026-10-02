import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const destination = path.resolve(process.argv[2])
const staging = fs.mkdtempSync(path.join(os.tmpdir(),'declarative-package-'))
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
  delete manifest.scripts; delete manifest.devDependencies; delete manifest.pnpm
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    if (String(version).startsWith('file:')) manifest.dependencies[name] = '0.10.0'
  }
  fs.writeFileSync(path.join(staging,'package.json'), JSON.stringify(manifest,null,2)+'\n')
  for (const item of manifest.files) fs.cpSync(path.join(root,item),path.join(staging,item),{recursive:true})
  fs.mkdirSync(destination,{recursive:true})
  const output = JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',staging],{cwd:staging,encoding:'utf8'}))[0]
  const archive = path.join(staging,output.filename)
  const digest = createHash('sha256').update(fs.readFileSync(archive)).digest('hex')
  const target = path.join(destination,digest); fs.mkdirSync(target,{recursive:true})
  const published = path.join(target,output.filename)
  if (fs.existsSync(published) && !fs.readFileSync(published).equals(fs.readFileSync(archive))) throw new Error('package/digest/conflict')
  if (!fs.existsSync(published)) fs.copyFileSync(archive,published,fs.constants.COPYFILE_EXCL)
  process.stdout.write(published+'\n')
} finally {fs.rmSync(staging,{recursive:true,force:true})}
