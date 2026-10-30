import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
test('dependency-free static development server serves the app and rejects hidden files', async t => {
  const probe=createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port=probe.address().port; await new Promise(resolve=>probe.close(resolve));
  const server=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}});
  await Promise.race([once(server.stdout,'data'), once(server,'exit').then(()=>{throw Error('Server exited before listening');})]);
  const origin=`http://127.0.0.1:${port}`;
  const page=await fetch(origin+'/'); assert.equal(page.status,200); assert.match(await page.text(),/mode-title/);
  assert.match((await fetch(origin+'/src/api.js')).headers.get('Content-Type'),/javascript/);
  assert.equal((await fetch(origin+'/.git/config')).status,403);
  assert.equal((await fetch(origin+'/missing')).status,404);
});
