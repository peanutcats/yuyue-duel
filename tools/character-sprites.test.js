'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Y=require('./shared-game');require('../js/char');require('../js/character-sprite-data');
test('every Web roster identity has matching transparent art and a bounded animation atlas',()=>{
 const data=Y.CharacterSpriteData,root=path.resolve(__dirname,'..');
 assert.deepEqual(Object.keys(data.characters).sort(),Y.CHARS.map(c=>c.id).sort());
 for(const [id,c]of Object.entries(data.characters)){
  assert.equal(c.name,Y.lookOf(id).name);assert.equal(Object.keys(c.parts).length,12);
  for(const rect of Object.values(c.parts)){
   assert.equal(rect.length,4);assert.ok(rect.every(Number.isFinite));
   assert.ok(rect[0]>=0&&rect[1]>=0&&rect[2]>20&&rect[3]>20&&rect[0]+rect[2]<=768&&rect[1]+rect[3]<=1024,id);
  }
  for(const kind of ['portrait','avatar','rig',...(c.hair?['hair']:[])]){
   const png=fs.readFileSync(path.join(root,'assets/characters/painted',id,kind+'.png'));
   assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.includes(Buffer.from('tRNS')),id+'/'+kind+' retains transparency');
  }
 }
});
