const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const part = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const vehicleName = 'ALS_1';
const waiting = (id, canWalk = 'no') => ({ id, stage: 'TRANSFER', canWalk });
const vehicle = (type = 'ALS') => ({ name: vehicleName, type, workflowState: 'LOADING_BAY' });
const job = (id, patientId) => ({
  id, patientId, fromZone: 'LOADING', toZone: 'VEHICLE:' + vehicleName, status: 'assigned',
});

async function run() {
  let root;
  let now = 1000;
  const ctx = vm.createContext({
    STATE: { cases: [], gc: {}, me: {}, porters: {} },
    KEYS: Object.fromEntries(['patients', 'porters', 'vehicles', 'cases', 'gc', 'locks'].map(k => [k, k])),
    sharedNowMs: () => ++now,
    elapsedMinutes: () => 10,
    vehicleWorkflowState: v => v.workflowState,
    patientIsDead: () => false,
    hasAnyTxInProgress: () => false,
    kvGet: async key => structuredClone(root[key]),
    kvRootTransaction: async callback => {
      const next = callback(structuredClone(root));
      if (next) root = next;
      return { committed: !!next, root };
    },
    porterJobForPatient: () => null,
    toast() {},
    render() {},
  });
  for (const [from, to] of [
    ['function norm(v)', 'function round1('],
    ['function findCase(', '\n}'],
    ['function effectiveCanWalk(', '/* v4.1'],
    ['function calcVehicleLoad(', 'function vehicleCapacityNote('],
    ['function normalizePorterPool(', 'async function deployPortersToScene('],
    ['function vehicleCanBoardAtLoading(', 'function porterJobForPatient('],
  ]) {
    const source = part(from, to);
    vm.runInContext(to === '\n}' ? source + to : source, ctx);
  }
  const setup = (patients, type, jobs = {}, cases = []) => {
    root = { patients, vehicles: [vehicle(type)], porters: { total: 10, deployed: 10, jobs }, cases, gc: {} };
  };
  const request = id => ctx.requestPorterJob(id, 'LOADING', 'VEHICLE:' + vehicleName, 'request-' + id);
  const board = id => ctx.boardPatientToVehicle(id, vehicleName, 'board-' + id);
  const onboard = () => root.vehicles[0].loadedPatientIds || [];

  for (const type of ['ALS', 'BLS']) {
    setup([waiting('A'), waiting('B'), waiting('C', 'yes')], type);
    assert.deepEqual(await Promise.all([request('A'), request('B')]), [true, false], type + ' reserves one stretcher');
    assert.equal(await board('C'), false, 'a seat cannot bypass a pending stretcher reservation');
    assert.deepEqual(onboard(), [], 'reservation does not mark a patient boarded');
    const [jobId] = Object.keys(root.porters.jobs);
    await ctx.completePorterJob(jobId);
    assert.deepEqual([...onboard()], ['A']);
    assert.equal(await request('B'), false, 'a second stretcher cannot board');
    assert.equal(await ctx.unboardPatientFromVehicle('A', vehicleName, 'unboard-A'), true);
    assert.equal(await request('B'), true, 'unboarding frees the stretcher');
  }

  setup([waiting('A', 'yes'), waiting('B', 'yes'), waiting('C', 'yes')], 'ALS', {}, [{ id: 'C', canWalk: 'no' }]);
  assert.equal(await board('A'), true);
  assert.equal(await request('C'), false, 'live case mobility overrides an older patient copy');
  assert.equal(await board('B'), true);
  assert.deepEqual([...onboard()], ['A', 'B']);

  setup([waiting('A'), ...Array.from({ length: 11 }, (_, i) => waiting('S' + i, 'yes'))], 'BUS');
  assert.equal(await request('A'), false, 'BUS cannot reserve a stretcher');
  for (let i = 0; i < 10; i++) assert.equal(await board('S' + i), true);
  assert.equal(await board('S10'), false, 'BUS seats at most ten');

  setup([waiting('A'), waiting('B')], 'ALS', { oldA: job('oldA', 'A'), oldB: job('oldB', 'B') });
  await ctx.completePorterJob('oldA');
  await ctx.completePorterJob('oldB');
  assert.deepEqual([...onboard()], ['A'], 'old rooms with two existing jobs still board only one stretcher');
  assert.equal(root.patients[1].boardedVehicle, undefined);

  console.log('PASS: loading reservations, live mobility, ALS/BLS and BUS capacity, unboarding and legacy porter jobs');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
