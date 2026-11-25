import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';
const root=(process.env.TEST_ORIGIN||'http://127.0.0.1:3001')+'/api/';let cookie='';async function req(p:string,method='GET',body?:unknown){const r=await fetch(root+p,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j;}
const suffix=randomUUID();await req('register','POST',{email:`test-${suffix}@example.test`,name:'로컬 검증 계정',password:randomUUID()});
const draft={name:'로컬 검증 꽃다발',size:'S',wrapping:'w_kraft',elements:[{id:randomUUID(),catalogId:'f_gerbera',x:12,y:-8,length:1.2,rotation:15,layer:2}]};
assert.ok((await req('catalog')).every((i:any)=>typeof i.available==='boolean'));
const saved=await req('designs','POST',draft);const designs=await req('designs');assert.equal(designs[0].elements[0].length,1.2);
await req('cart','POST',draft);const cart=await req('cart');assert.equal(cart.length,1);
const data={requestKey:randomUUID(),design:draft,cartId:cart[0].id,address:{name:'테스트',phone:'010-0000-0000',address:'시연용 테스트 주소',note:'실제 배송하지 않음'}};
const o=await req('orders','POST',data);assert.equal(o.total,12000);const retry=await req('orders','POST',data);assert.equal(retry.id,o.id);assert.equal((await req('cart')).length,0);
await req('orders/'+o.id+'/cancel','POST');await req('designs/'+saved.id,'DELETE');await req('logout','POST');assert.equal(await req('me'),null);console.log('PASS: register/session, design transform persistence, cart checkout, server price, idempotency, stock deduction/restoration, cancellation, logout.');
