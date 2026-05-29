import { chromium } from '@playwright/test'
const dir = process.argv[2] ?? 'before'
const targets = [['login','/login'],['fixture-layout-shell','/__fixtures/layout-shell']]
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:1440,height:900} })
for (const [name,path] of targets) {
  await p.goto('http://127.0.0.1:3000'+path,{waitUntil:'networkidle'}).catch(()=>{})
  await p.waitForTimeout(1000)
  await p.screenshot({path:`.claude/specs/screenshots/${dir}/${name}.png`})
  console.log('captured', name, '@', p.url())
}
await b.close()
