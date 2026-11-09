import assert from 'node:assert/strict';
import {Scorecard} from './js/scoring.mjs';
import {LanePhysics} from './js/physics.mjs';
function game(rolls){let s=new Scorecard();for(let n of rolls)s.add(n);return s;}
assert.equal(game(Array(12).fill(10)).total(),300);
assert.equal(game([...Array(18).fill(5),5,5,5]).total(),150);
assert.equal(game(Array(20).fill(0)).total(),0);
assert.equal(game(Array(20).fill(4)).total(),80);
assert.equal(game([10,7,3,9,0,10,0,8,8,2,0,6,10,10,10,8,1]).total(),167);
assert.equal(game([...Array(18).fill(0),10,7,3]).total(),20);
assert.equal(game([...Array(18).fill(0),7,3,10]).total(),20);
assert.equal(game([...Array(18).fill(0),10,10,10]).total(),30);
assert.equal(game([...Array(18).fill(0),10,7,2]).total(),19);
let s=game([10]);assert.equal(s.scores()[0],null);s.add(3);s.add(4);assert.equal(s.scores()[0],17);assert.equal(s.scores()[1],24);
assert.throws(()=>new Scorecard().add(11));s=game([8]);assert.throws(()=>s.add(3));
s=game([...Array(18).fill(0),10,7]);assert.equal(s.remaining(),3);assert.deepEqual(game([...Array(18).fill(0),10,7,3]).symbols(9),['X','7','/']);
assert.deepEqual(game([...Array(18).fill(0),7,3,10]).symbols(9),['7','/','X']);
console.log('Scoring: perfect, all spares, gutters, mixed, tenth-frame variants and invalid rolls PASS');
function roll(opts){let p=new LanePhysics();p.launch(opts);for(let n=0;n<1200;n++){if(p.step())break;}assert.ok(!p.rolling);assert.ok(p.pins.every(p=>Number.isFinite(p.body.position.x)));return {pins:p.knocked(),gutter:p.gutter,pos:p.ball.position.toString()};}
for(let aim of [-2,-1,-.5,0,.5,1,2])console.log('Shot',aim,JSON.stringify(roll({aim,power:70})));
let gutter=roll({aim:3,position:.4});assert.equal(gutter.gutter,true);assert.equal(gutter.pins,0);
let bumper=roll({aim:3,position:.4,bumpers:true});assert.equal(bumper.gutter,false);
console.log('Gutters and bumpers PASS',bumper);

assert.ok(roll({power:70,aim:0}).pins>=6);
assert.equal(roll({power:65,aim:.35}).pins,10);
console.log('Balanced center shot and pocket strike PASS');
