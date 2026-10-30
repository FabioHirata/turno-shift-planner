// End-to-end HTTP contract: compile real Go server, run on loopback with temporary storage,
// and drive it through the browser's JavaScript API client. No browser/DOM is mocked here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createAPI } from '../src/api.js';
import { demoState, analyze, PEOPLE } from '../src/domain.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const normalize = report => ({...report, conflicts:report.conflicts.map(({text,...rest})=>rest)});
test('real Go HTTP server and JavaScript client share rules, persistence and revision semantics', async t => {
  const dir = await mkdtemp(join(tmpdir(),'turno-contract-'));
  const binary = join(dir, process.platform === 'win32' ? 'turno.exe' : 'turno');
  let server;
  t.after(async()=>{ if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server,'exit'); } await rm(dir,{recursive:true,force:true}); });
  const build = spawnSync(process.env.GO || 'go',['build','-buildvcs=false','-o',binary,'.'],{cwd:join(root,'backend'),encoding:'utf8'});
  assert.equal(build.status,0,build.stderr || build.error?.message || 'Go build failed');
  const probe=createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port=probe.address().port; await new Promise(resolve=>probe.close(resolve));
  const origin=`http://127.0.0.1:${port}`;
  async function start() {
    server=spawn(binary,['--addr',`127.0.0.1:${port}`,'--data',join(dir,'state.json'),'--web',join(root,'dist')],{stdio:['ignore','pipe','pipe']});
    let logs=''; server.stderr.on('data',data=>logs+=data);
    const deadline=Date.now()+10000;
    while (Date.now()<deadline) {
      if (server.exitCode !== null) throw Error(logs);
      try { const r=await fetch(origin+'/api/health'); if(r.ok) return; } catch {}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw Error('Go API startup timed out: '+logs);
  }
  const api=createAPI((url,options)=>fetch(origin+url,options));
  await start();
  await t.test('static frontend and initial report are served by Go',async()=>{
    const page=await fetch(origin+'/?mode=api'); assert.equal(page.status,200); assert.match(await page.text(),/mode-title/);
    const result=await api.load(); assert.equal(result.revision,1); assert.deepEqual(normalize(result.report),normalize(analyze(demoState())));
  });
  await t.test('assignment and availability changes use real HTTP and server-derived coverage',async()=>{
    let r=await api.assign(1,'davi',6,'afternoon'); assert.equal(r.report.covered,13);
    r=await api.availability(r.revision,'clara',1,[]); assert.equal(r.report.covered,14); assert.equal(r.report.conflicts.length,0);
    assert.deepEqual(normalize(r.report),normalize(analyze(r.state)));
  });
  await t.test('stale revision cannot overwrite the saved schedule',async()=>{
    await assert.rejects(api.assign(1,'ana',0,'off'),e=>e.status===409);
    assert.equal((await api.load()).state.assignments.ana[0],'morning');
  });
  await t.test('Go and JavaScript reports match 30 deterministic varied schedules',async()=>{
    let revision=(await api.load()).revision;
    for(let seed=0;seed<30;seed++) {
      const state=demoState();
      PEOPLE.forEach((p,i)=>{state.assignments[p.id]=Array.from({length:7},(_,d)=>['off','morning','afternoon'][(seed*7+i*5+d*(seed%3+1))%3]); state.availability[p.id][String(seed%7)]=seed%2?[]:['morning'];});
      const response=await fetch(origin+'/api/weeks/2026-11-02',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,assignments:state.assignments,availability:state.availability})});
      assert.equal(response.status,200); const data=await response.json(); revision=data.revision;
      assert.deepEqual(normalize(data.report),normalize(analyze(state)),`seed ${seed}`);
    }
  });
  await t.test('committed state survives a clean server restart',async()=>{
    const before=await api.load(); server.kill('SIGTERM'); await once(server,'exit'); await start();
    const after=await api.load(); assert.deepEqual(after,before);
    const reset=await api.reset(after.revision); assert.deepEqual(reset.state,demoState());
  });
});
