import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReportingTemplate } from './reportingTemplate.js';
test('template supplies only missing hints and preserves authored content', () => {
  const before={title:'My detailed report',description:'Keep these details',affectedService:'EMAIL'};
  assert.deepEqual(applyReportingTemplate(before,'Wi-Fi issue',{serviceCode:'CAMPUS_WIFI'},[],true),before);
  const result=applyReportingTemplate({...before,title:'',affectedService:''},'Wi-Fi issue',{serviceCode:'CAMPUS_WIFI'},[],true);
  assert.equal(result.title,'Wi-Fi issue'); assert.equal(result.affectedService,'CAMPUS_WIFI'); assert.equal(result.description,before.description);
});
test('old backend capability and Other choice never fabricate a service hint', () => {
  const result=applyReportingTemplate({title:'Wi-Fi issue',description:'Details',affectedService:''},'Other IT problem',null,['Wi-Fi issue'],false);
  assert.equal(result.title,''); assert.equal(result.affectedService,'');
});
test('mapped category fills only an empty selection', () => {
  assert.equal(applyReportingTemplate({title:'',category:''},'Mesh issue',{categoryCode:'RESEARCH_NETWORK'},[],true).category,'RESEARCH_NETWORK');
  assert.equal(applyReportingTemplate({title:'',category:'SOFTWARE'},'Mesh issue',{categoryCode:'RESEARCH_NETWORK'},[],true).category,'SOFTWARE');
});
