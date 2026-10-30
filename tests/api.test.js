import test from 'node:test';
import assert from 'node:assert/strict';
import { createAPI, APIError } from '../src/api.js';
import { demoState, analyze } from '../src/domain.js';
const payload = () => ({...demoState(), week:'2026-11-02', revision:1, report:analyze(demoState())});
const response = (data, status=200) => ({ok:status>=200&&status<300,status,json:async()=>data});
test('API client reads same-origin canonical state without sending browser demo', async () => {
  let call; const api=createAPI(async (...args)=>{call=args; return response(payload());});
  const result=await api.load(); assert.equal(result.revision,1); assert.equal(result.report.covered,12);
  assert.equal(call[0],'/api/weeks/2026-11-02'); assert.equal(call[1].method,'GET'); assert.equal(call[1].body,undefined);
});
test('assignment, availability and reset carry revision and correct method', async () => {
  const calls=[]; const api=createAPI(async (...args)=>{calls.push(args); return response(payload());});
  await api.assign(3,'ana',0,'off'); await api.availability(4,'clara',1,[]); await api.reset(5);
  assert.equal(calls[0][1].method,'PATCH'); assert.deepEqual(JSON.parse(calls[0][1].body),{revision:3,personId:'ana',day:0,shift:'off'});
  assert.ok(calls[1][0].endsWith('/availability')); assert.equal(calls[1][1].method,'PUT');
  assert.deepEqual(JSON.parse(calls[2][1].body),{revision:5}); assert.equal(calls[2][1].headers['Content-Type'],'application/json');
});
test('stale revision, malformed data and server failures are explicit errors', async () => {
  await assert.rejects(createAPI(async()=>response({},409)).load(),e=>e instanceof APIError&&e.status===409);
  for (const data of [{}, {...payload(),revision:0}, {...payload(),availability:null}, {...payload(),report:{...payload().report,covered:99}}]) {
    await assert.rejects(createAPI(async()=>response(data)).load(),e=>e.code==='invalid_response');
  }
  await assert.rejects(createAPI(async()=>{throw Error('offline');}).load(),e=>e.code==='network_error');
});
test('slow API is aborted instead of waiting indefinitely', async () => {
  const api=createAPI((_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))),5);
  await assert.rejects(api.load(),e=>e.code==='timeout');
});
