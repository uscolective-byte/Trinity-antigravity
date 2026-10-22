import bundledCatalog from '../config/revolut-pro-products.json' with {type:'json'};
import {z} from 'zod';
import {HttpError} from './security.js';

const CONFIG_KEY='payments:revolut-pro:products:v1';
const PAYPAL_CONFIG_KEY='payments:paypal:products:v1';
const COMMERCE_ACCOUNTS_KEY='payments:commerce:accounts:v1';
const productId=z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);

export const proPaymentUrl=z.string().max(2048).url().refine(value=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname!=='/'&&['checkout.revolut.com','pay.revolut.com','revolut.me'].includes(u.hostname);
 }catch{return false;}
},'Použi platobný HTTPS odkaz vytvorený v Revolut Pro.').transform(value=>new URL(value).href);

export const paypalPaymentUrl=z.string().max(2048).url().refine(value=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname!=='/'&&['paypal.com','www.paypal.com','paypal.me','www.paypal.me'].includes(u.hostname);
 }catch{return false;}
},'Použi platobný HTTPS odkaz vytvorený v PayPal (paypal.me alebo paypal.com).').transform(value=>new URL(value).href);

export const proProductSchema=z.object({
 id:productId,
 name:z.string().trim().min(1).max(120),
 description:z.string().trim().max(1000).default(''),
 amount_cents:z.number().int().min(100).max(1000000),
 currency:z.literal('EUR'),
 payment_url:proPaymentUrl,
 active:z.boolean().default(true),
 expires_at:z.string().datetime({offset:true}).nullable().default(null)
}).strict();

export const paypalProductSchema=z.object({
 id:productId,
 name:z.string().trim().min(1).max(120),
 description:z.string().trim().max(1000).default(''),
 amount_cents:z.number().int().min(100).max(1000000),
 currency:z.literal('EUR'),
 payment_url:paypalPaymentUrl,
 active:z.boolean().default(true),
 expires_at:z.string().datetime({offset:true}).nullable().default(null)
}).strict();

export const proCatalogSchema=z.object({products:z.array(proProductSchema).max(20)}).strict().superRefine((data,ctx)=>{
 if(new Set(data.products.map(p=>p.id)).size!==data.products.length)ctx.addIssue({code:'custom',path:['products'],message:'ID produktov sa nesmú opakovať.'});
});

export const paypalCatalogSchema=z.object({products:z.array(paypalProductSchema).max(20)}).strict().superRefine((data,ctx)=>{
 if(new Set(data.products.map(p=>p.id)).size!==data.products.length)ctx.addIssue({code:'custom',path:['products'],message:'ID produktov sa nesmú opakovať.'});
});

export const commerceAccountsSchema=z.object({
 business_name:z.string().trim().max(120).default(''),
 revolut_url:z.union([proPaymentUrl,z.literal('')]).default(''),
 paypal_url:z.union([paypalPaymentUrl,z.literal('')]).default(''),
 default_currency:z.literal('EUR').default('EUR'),
 note:z.string().trim().max(500).default('')
}).strict();

async function catalog(env){
 const stored=env.Mastermind?await env.Mastermind.get(CONFIG_KEY):null;
 const raw=stored??env.REVOLUT_PRO_PRODUCTS_JSON??JSON.stringify(bundledCatalog);
 try{return proCatalogSchema.parse(JSON.parse(raw));}catch{throw new HttpError(503,'Neplatná konfigurácia Revolut Pro produktov.');}
}

async function paypalCatalog(env){
 const stored=env.Mastermind?await env.Mastermind.get(PAYPAL_CONFIG_KEY):null;
 const raw=stored??env.PAYPAL_PRODUCTS_JSON??JSON.stringify({products:[]});
 try{return paypalCatalogSchema.parse(JSON.parse(raw));}catch{throw new HttpError(503,'Neplatná konfigurácia PayPal produktov.');}
}

async function commerceAccounts(env){
 const stored=env.Mastermind?await env.Mastermind.get(COMMERCE_ACCOUNTS_KEY):null;
 if(!stored)return commerceAccountsSchema.parse({});
 try{return commerceAccountsSchema.parse(JSON.parse(stored));}catch{return commerceAccountsSchema.parse({});}
}

function available(product){return product.active&&(!product.expires_at||Date.parse(product.expires_at)>Date.now());}
function publicProduct(product,provider='revolut-pro'){
 const prefix=provider==='paypal'?'/pay/paypal/':'/pay/revolut-pro/';
 return {id:product.id,provider,name:product.name,description:product.description,amount_cents:product.amount_cents,currency:product.currency,checkout_path:prefix+product.id};
}

export async function revolutProStatus(env){
 const data=await catalog(env);
 return {provider:'revolut-pro',mode:'live-payment-links',configured:data.products.some(available),bank_account_connected:false,automatic_payment_verification:false,payment_status:'not_checked',products:data.products};
}

export async function configureRevolutPro(env,ownerId,input){
 const data=proCatalogSchema.parse(input);
 if(!env.Mastermind)throw new HttpError(503,'Úložisko konfigurácie Revolut Pro nie je pripojené.');
 // Saving public checkout links does not grant account access or payment authority.
 await env.Mastermind.put(CONFIG_KEY,JSON.stringify(data),{metadata:{owner_id:ownerId,updated_at:new Date().toISOString()}});
 return {...await revolutProStatus(env),saved:true};
}

export async function paypalStatus(env){
 const data=await paypalCatalog(env);
 return {provider:'paypal',mode:'live-payment-links',configured:data.products.some(available),bank_account_connected:false,automatic_payment_verification:false,payment_status:'not_checked',products:data.products};
}

export async function configurePaypal(env,ownerId,input){
 const data=paypalCatalogSchema.parse(input);
 if(!env.Mastermind)throw new HttpError(503,'Úložisko konfigurácie PayPal nie je pripojené.');
 await env.Mastermind.put(PAYPAL_CONFIG_KEY,JSON.stringify(data),{metadata:{owner_id:ownerId,updated_at:new Date().toISOString()}});
 return {...await paypalStatus(env),saved:true};
}

export async function commerceStatus(env){
 const [revolut,paypal,accounts]=await Promise.all([revolutProStatus(env),paypalStatus(env),commerceAccounts(env)]);
 const activeRevolut=revolut.products.filter(available);
 const activePaypal=paypal.products.filter(available);
 const allProducts=[...revolut.products.map(p=>({...p,provider:'revolut-pro',checkout_path:'/pay/revolut-pro/'+p.id})),...paypal.products.map(p=>({...p,provider:'paypal',checkout_path:'/pay/paypal/'+p.id}))];
 const activeProducts=[...activeRevolut,...activePaypal];
 const totalCatalogCents=activeProducts.reduce((sum,p)=>sum+(Number(p.amount_cents)||0),0);
 const providersReady=[];
 if(revolut.configured||accounts.revolut_url)providersReady.push('revolut-pro');
 if(paypal.configured||accounts.paypal_url)providersReady.push('paypal');
 return {
  mode:'live-payment-links',
  configured:providersReady.length>0,
  bank_account_connected:false,
  automatic_payment_verification:false,
  payment_status:'not_checked',
  accounts,
  revolut,
  paypal,
  products:allProducts,
  summary:{
   total_products:allProducts.length,
   active_products:activeProducts.length,
   total_catalog_cents:totalCatalogCents,
   total_catalog_eur:Number((totalCatalogCents/100).toFixed(2)),
   providers_ready:providersReady
  }
 };
}

export async function configureCommerceAccounts(env,ownerId,input){
 const data=commerceAccountsSchema.parse(input);
 if(!env.Mastermind)throw new HttpError(503,'Úložisko obchodného profilu nie je pripojené.');
 await env.Mastermind.put(COMMERCE_ACCOUNTS_KEY,JSON.stringify(data),{metadata:{owner_id:ownerId,updated_at:new Date().toISOString()}});
 return {...await commerceStatus(env),saved:true};
}

export async function upsertCommerceProduct(env,ownerId,input){
 const provider=input?.provider==='paypal'?'paypal':'revolut-pro';
 const rawProduct=input?.product||input;
 const parsed=provider==='paypal'?paypalProductSchema.parse(rawProduct):proProductSchema.parse(rawProduct);
 const current=provider==='paypal'?await paypalCatalog(env):await catalog(env);
 const nextProducts=current.products.filter(p=>p.id!==parsed.id);
 nextProducts.push(parsed);
 if(provider==='paypal'){
  await configurePaypal(env,ownerId,{products:nextProducts});
 }else{
  await configureRevolutPro(env,ownerId,{products:nextProducts});
 }
 return {...await commerceStatus(env),saved:true,provider,updated_product_id:parsed.id};
}

export async function deleteCommerceProduct(env,ownerId,provider,id){
 const normProvider=provider==='paypal'?'paypal':'revolut-pro';
 const validId=productId.parse(String(id||'').trim());
 const current=normProvider==='paypal'?await paypalCatalog(env):await catalog(env);
 const nextProducts=current.products.filter(p=>p.id!==validId);
 if(normProvider==='paypal'){
  await configurePaypal(env,ownerId,{products:nextProducts});
 }else{
  await configureRevolutPro(env,ownerId,{products:nextProducts});
 }
 return {...await commerceStatus(env),deleted:true,provider:normProvider,deleted_product_id:validId};
}

export async function handleRevolutProPublic(request,env){
 const url=new URL(request.url),path=url.pathname;
 const checkout=path.match(/^\/pay\/revolut-pro\/([a-z0-9][a-z0-9_-]{0,79})$/);
 const listing=path==='/api/payments/revolut-pro';
 if(!checkout&&!listing)return null;
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 const data=await catalog(env);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 if(listing)return Response.json({provider:'revolut-pro',mode:'live-payment-links',products:data.products.filter(available).map(p=>publicProduct(p,'revolut-pro')),payment_status:'not_checked',automatic_payment_verification:false},{headers});
 const product=data.products.find(p=>p.id===checkout[1]&&available(p));
 if(!product)throw new HttpError(404,'Platobný odkaz nie je dostupný.');
 // The destination is owner-configured and validated; a URL query cannot replace it.
 return new Response(null,{status:302,headers:{...headers,Location:product.payment_url}});
}

export async function handlePaypalPublic(request,env){
 const url=new URL(request.url),path=url.pathname;
 const checkout=path.match(/^\/pay\/paypal\/([a-z0-9][a-z0-9_-]{0,79})$/);
 const listing=path==='/api/payments/paypal';
 if(!checkout&&!listing)return null;
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 const data=await paypalCatalog(env);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 if(listing)return Response.json({provider:'paypal',mode:'live-payment-links',products:data.products.filter(available).map(p=>publicProduct(p,'paypal')),payment_status:'not_checked',automatic_payment_verification:false},{headers});
 const product=data.products.find(p=>p.id===checkout[1]&&available(p));
 if(!product)throw new HttpError(404,'Platobný odkaz PayPal nie je dostupný.');
 return new Response(null,{status:302,headers:{...headers,Location:product.payment_url}});
}

export async function handleCommercePublic(request,env){
 const rev=await handleRevolutProPublic(request,env);
 if(rev)return rev;
 const pp=await handlePaypalPublic(request,env);
 if(pp)return pp;
 const url=new URL(request.url),path=url.pathname;
 if(path!=='/api/payments/catalog')return null;
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 const [revData,ppData,accounts]=await Promise.all([catalog(env),paypalCatalog(env),commerceAccounts(env)]);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 const products=[
  ...revData.products.filter(available).map(p=>publicProduct(p,'revolut-pro')),
  ...ppData.products.filter(available).map(p=>publicProduct(p,'paypal'))
 ];
 return Response.json({
  mode:'live-payment-links',
  bank_account_connected:false,
  automatic_payment_verification:false,
  payment_status:'not_checked',
  business_name:accounts.business_name||'',
  providers:{
   revolut_pro:revData.products.some(available)||Boolean(accounts.revolut_url),
   paypal:ppData.products.some(available)||Boolean(accounts.paypal_url)
  },
  products
 },{headers});
}
