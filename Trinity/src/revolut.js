import {z} from 'zod';
import {HttpError} from './security.js';

const API_VERSION='2026-08-17';
export const checkoutSchema=z.object({product_id:z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),idempotency_key:z.string().uuid()}).strict();
const productSchema=z.object({id:checkoutSchema.shape.product_id,name:z.string().trim().min(1).max(200),amount_cents:z.number().int().min(100).max(1000000),currency:z.literal('EUR')}).strict();
function configuration(env){
 const mode=env.REVOLUT_MODE||'sandbox';
 if(!['sandbox','production'].includes(mode))throw new HttpError(503,'Neplatný Revolut režim.');
 if(mode==='production'&&env.REVOLUT_LIVE_PAYMENTS_ENABLED!=='true')throw new HttpError(503,'Reálne Revolut platby nie sú zapnuté.');
 let products;
 try{products=z.array(productSchema).max(50).parse(JSON.parse(env.REVOLUT_PRODUCTS_JSON||(mode==='sandbox'?'[{"id":"sandbox-test","name":"Trinity test – nie skutočný predaj","amount_cents":100,"currency":"EUR"}]':'[]')));}catch{throw new HttpError(503,'Neplatný serverový cenník.');}
 if(new Set(products.map(p=>p.id)).size!==products.length)throw new HttpError(503,'Cenník obsahuje duplicitné produkty.');
 const key=mode==='sandbox'?env.REVOLUT_SANDBOX_SECRET_KEY:env.REVOLUT_MERCHANT_SECRET_KEY;
 return {mode,products,key,origin:mode==='sandbox'?'https://sandbox-merchant.revolut.com':'https://merchant.revolut.com'};
}
export function revolutStatus(env){
 const c=configuration(env);
 return {provider:'revolut',mode:c.mode,configured:!!c.key,live_enabled:c.mode==='production',products:c.products,automatic_fulfilment:false};
}
async function api(c,path,body,fetcher){
 if(!c.key)throw new HttpError(503,'Revolut Merchant kľúč nie je nastavený pre tento režim.');
 const response=await fetcher(c.origin+'/api'+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+c.key,'Revolut-Api-Version':API_VERSION,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw new HttpError(502,`Revolut API HTTP ${response.status}.`);
 return response.json();
}
function present(row){return {id:row.id,mode:row.mode,product_id:row.product_id,description:row.description,amount_cents:row.amount_cents,currency:row.currency,provider_order_id:row.provider_order_id,checkout_url:row.checkout_url,state:row.state,payment_confirmed:row.payment_confirmed===1,refunded_amount_cents:row.refunded_amount_cents,verified_at:row.verified_at,real_money:row.mode==='production'};}
function verifyOrder(order,row){
 if(order.id!==row.provider_order_id||order.amount!==row.amount_cents||order.currency!==row.currency||order.type!=='payment'||typeof order.state!=='string')throw new HttpError(502,'Revolut objednávka nezodpovedá lokálnemu záznamu.');
 const refunded=order.refunded_amount??0;
 if(!Number.isSafeInteger(refunded)||refunded<0||refunded>row.amount_cents)throw new HttpError(502,'Neplatná refundovaná suma.');
 return {state:order.state,refunded,confirmed:order.state==='completed'&&order.outstanding_amount===0};
}
export async function createRevolutCheckout(env,ownerId,input,fetcher=fetch){
 const data=checkoutSchema.parse(input),c=configuration(env);
 if(!c.key)throw new HttpError(503,'Revolut Merchant kľúč nie je nastavený pre tento režim.');
 const existing=await env.DB.prepare('SELECT * FROM ops_revolut_payments WHERE owner_id=? AND mode=? AND request_key=?').bind(ownerId,c.mode,data.idempotency_key).first();
 if(existing){if(existing.product_id!==data.product_id)throw new HttpError(409,'Tento kľúč už patrí inému produktu.');return {...present(existing),reused:true};}
 const product=c.products.find(p=>p.id===data.product_id);
 if(!product)throw new HttpError(400,'Produkt nie je v serverovom cenníku.');
 const id=crypto.randomUUID();
 const inserted=await env.DB.prepare(`INSERT INTO ops_revolut_payments(id,owner_id,request_key,mode,product_id,description,amount_cents,currency) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,mode,request_key) DO NOTHING RETURNING *`).bind(id,ownerId,data.idempotency_key,c.mode,product.id,product.name,product.amount_cents,product.currency).first();
 if(!inserted){
  const duplicate=await env.DB.prepare('SELECT * FROM ops_revolut_payments WHERE owner_id=? AND mode=? AND request_key=?').bind(ownerId,c.mode,data.idempotency_key).first();
  if(!duplicate||duplicate.product_id!==data.product_id)throw new HttpError(409,'Konflikt platobnej požiadavky.');
  return {...present(duplicate),reused:true};
 }
 try{
  const order=await api(c,'/orders',{amount:product.amount_cents,currency:product.currency,description:product.name,capture_mode:'automatic',metadata:{trinity_payment_id:id}},fetcher);
  if(typeof order.id!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(order.id))throw new Error('Invalid order id');
  // Preserve the remote ID before validating optional checkout fields, so failures can be reconciled.
  await env.DB.prepare('UPDATE ops_revolut_payments SET provider_order_id=? WHERE id=?').bind(order.id,id).run();
  const checkout=new URL(order.checkout_url);
  const hosts=c.mode==='sandbox'?['checkout.revolut.codes','checkout.revolut.com']:['checkout.revolut.com'];
  if(checkout.protocol!=='https:'||!hosts.includes(checkout.hostname)||checkout.username||checkout.password||checkout.port)throw new Error('Invalid checkout URL');
  const verified=verifyOrder(order,{...inserted,provider_order_id:order.id});
  await env.DB.prepare('UPDATE ops_revolut_payments SET checkout_url=?,state=?,payment_confirmed=?,refunded_amount_cents=?,verified_at=datetime(\'now\') WHERE id=?').bind(checkout.href,verified.state,verified.confirmed?1:0,verified.refunded,id).run();
 }catch{
  await env.DB.prepare("UPDATE ops_revolut_payments SET state='create_unknown',payment_confirmed=0 WHERE id=?").bind(id).run();
  throw new HttpError(502,`Vytvorenie platby nie je potvrdené. Záznam ${id} vyžaduje kontrolu; neopakuj ho s novým kľúčom.`);
 }
 return present(await env.DB.prepare('SELECT * FROM ops_revolut_payments WHERE id=? AND owner_id=?').bind(id,ownerId).first());
}
export async function getRevolutPayment(env,ownerId,id,refresh=false,fetcher=fetch){
 let row=await env.DB.prepare('SELECT * FROM ops_revolut_payments WHERE id=? AND owner_id=?').bind(id,ownerId).first();
 if(!row)throw new HttpError(404,'Platba neexistuje.');
 if(refresh){
  const c=configuration(env);
  if(c.mode!==row.mode)throw new HttpError(409,'Pre overenie platby vyber jej pôvodný režim.');
  if(!row.provider_order_id)throw new HttpError(409,'Chýba ID Revolut objednávky; potrebná je ručná kontrola podľa metadata.trinity_payment_id.');
  const order=await api(c,'/orders/'+row.provider_order_id,undefined,fetcher),v=verifyOrder(order,row);
  await env.DB.prepare("UPDATE ops_revolut_payments SET state=?,payment_confirmed=?,refunded_amount_cents=?,verified_at=datetime('now') WHERE id=? AND owner_id=?").bind(v.state,v.confirmed?1:0,v.refunded,id,ownerId).run();
  row=await env.DB.prepare('SELECT * FROM ops_revolut_payments WHERE id=? AND owner_id=?').bind(id,ownerId).first();
 }
 return present(row);
}
