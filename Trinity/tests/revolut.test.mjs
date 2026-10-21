import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {checkoutSchema,revolutStatus,createRevolutCheckout,getRevolutPayment} from '../src/revolut.js';
let mf,db;
before(async()=>{
 mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'revolut-test',modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-10-01',d1Databases:{DB:'revolut-tests'}}]}));
 db=await mf.getD1Database('DB');
 for(const sql of readFileSync('migrations/0042_revolut_payments.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
});
after(async()=>{await mf?.dispose();});
const env=()=>({DB:db,REVOLUT_SANDBOX_SECRET_KEY:'fake-sandbox-secret'});
const input=()=>({product_id:'sandbox-test',idempotency_key:crypto.randomUUID()});
const providerId=()=>`6516e61c-d279-a454-a837-${crypto.randomUUID().replaceAll('-','').slice(0,12)}`;
const order=(id,extra={})=>({id,type:'payment',amount:100,currency:'EUR',state:'pending',outstanding_amount:100,checkout_url:'https://checkout.revolut.com/payment-link/test',...extra});
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('Revolut defaults to sandbox, hides secrets and requires explicit production activation',()=>{
 const s=revolutStatus(env());assert.equal(s.mode,'sandbox');assert.equal(s.live_enabled,false);assert.equal(JSON.stringify(s).includes('fake-sandbox-secret'),false);
 assert.throws(()=>revolutStatus({...env(),REVOLUT_MODE:'production'}),/nie sú zapnuté/);
 assert.throws(()=>revolutStatus({...env(),REVOLUT_MODE:'invalid'}),/Neplatný/);
 assert.equal(revolutStatus({...env(),REVOLUT_MODE:'production',REVOLUT_LIVE_PAYMENTS_ENABLED:'true'}).configured,false);
 assert.equal(checkoutSchema.safeParse({...input(),amount_cents:1}).success,false);
});
test('checkout uses server price, sandbox and pinned API; repeated request creates one order',async()=>{
 let calls=0;const id=providerId(),request=input();
 const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://sandbox-merchant.revolut.com/api/orders');assert.equal(options.redirect,'error');assert.equal(options.headers['Revolut-Api-Version'],'2026-08-17');assert.equal(JSON.parse(options.body).amount,100);return response(order(id));};
 const created=await createRevolutCheckout(env(),'owner',request,fetcher);
 assert.equal(created.real_money,false);assert.equal(created.payment_confirmed,false);assert.equal(created.provider_order_id,id);
 const duplicate=await createRevolutCheckout(env(),'owner',request,fetcher);assert.equal(duplicate.id,created.id);assert.equal(duplicate.reused,true);assert.equal(calls,1);
 await assert.rejects(createRevolutCheckout(env(),'owner',{...request,product_id:'different'},fetcher),/inému produktu/);
});
test('concurrent checkout calls cannot create duplicate remote orders',async()=>{
 const request=input();let calls=0;
 const fetcher=async()=>{calls++;return response(order(providerId()));};
 const [a,b]=await Promise.all([createRevolutCheckout(env(),'race',request,fetcher),createRevolutCheckout(env(),'race',request,fetcher)]);
 assert.equal(a.id,b.id);assert.equal(calls,1);
});
test('a lost creation response is not retried; ambiguous order remains available for reconciliation',async()=>{
 const request=input();let calls=0;const fetcher=async()=>{calls++;throw new Error('lost response with secret');};
 await assert.rejects(createRevolutCheckout(env(),'lost',request,fetcher),error=>error.status===502&&!error.message.includes('secret'));
 const result=await createRevolutCheckout(env(),'lost',request,fetcher);assert.equal(result.state,'create_unknown');assert.equal(calls,1);assert.equal(result.payment_confirmed,false);
 await assert.rejects(getRevolutPayment(env(),'lost',result.id,true,fetcher),/ručná kontrola/);
});
test('refresh verifies captured payment, records refunds and protects owner records',async()=>{
 const id=providerId(),created=await createRevolutCheckout(env(),'seller',input(),async()=>response(order(id)));
 await assert.rejects(getRevolutPayment(env(),'other-owner',created.id),error=>error.status===404);
 const done=await getRevolutPayment(env(),'seller',created.id,true,async url=>{assert.ok(url.endsWith('/orders/'+id));return response(order(id,{state:'completed',outstanding_amount:0,refunded_amount:25}));});
 assert.equal(done.payment_confirmed,true);assert.equal(done.refunded_amount_cents,25);assert.ok(done.verified_at);assert.equal(done.real_money,false);
 const authorised=await getRevolutPayment(env(),'seller',created.id,true,async()=>response(order(id,{state:'authorised'})));assert.equal(authorised.payment_confirmed,false);
 for(const extra of [{amount:101},{currency:'USD'},{id:providerId()},{type:'refund'},{refunded_amount:101}])await assert.rejects(getRevolutPayment(env(),'seller',created.id,true,async()=>response(order(id,extra))),error=>error.status===502);
});
test('invalid checkout host is refused, but remote ID survives for reconciliation',async()=>{
 const request=input(),id=providerId();
 await assert.rejects(createRevolutCheckout(env(),'url',request,async()=>response(order(id,{checkout_url:'https://evil.example/pay'}))),error=>error.status===502);
 const result=await createRevolutCheckout(env(),'url',request);assert.equal(result.provider_order_id,id);assert.equal(result.checkout_url,null);
});
test('production cannot refresh sandbox data; missing credentials and products never call provider',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw new Error('must not call');};
 await assert.rejects(createRevolutCheckout({DB:db},'x',input(),fetcher),error=>error.status===503);
 await assert.rejects(createRevolutCheckout(env(),'x',{...input(),product_id:'not-listed'},fetcher),error=>error.status===400);assert.equal(calls,0);
 const created=await createRevolutCheckout(env(),'mode',input(),async()=>response(order(providerId())));
 await assert.rejects(getRevolutPayment({...env(),REVOLUT_MODE:'production',REVOLUT_LIVE_PAYMENTS_ENABLED:'true'},'mode',created.id,true,fetcher),error=>error.status===409);
});
