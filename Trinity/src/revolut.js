import bundledCatalog from '../config/revolut-pro-products.json' with {type:'json'};
import {z} from 'zod';
import {HttpError} from './security.js';

const CONFIG_KEY='payments:revolut-pro:products:v1';
const productId=z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
export const proPaymentUrl=z.string().max(2048).url().refine(value=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname!=='/'&&['checkout.revolut.com','pay.revolut.com','revolut.me'].includes(u.hostname);
 }catch{return false;}
},'Použi platobný HTTPS odkaz vytvorený v Revolut Pro.');
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
export const proCatalogSchema=z.object({products:z.array(proProductSchema).max(20)}).strict().superRefine((data,ctx)=>{
 if(new Set(data.products.map(p=>p.id)).size!==data.products.length)ctx.addIssue({code:'custom',path:['products'],message:'ID produktov sa nesmú opakovať.'});
});
async function catalog(env){
 const stored=env.Mastermind?await env.Mastermind.get(CONFIG_KEY):null;
 const raw=stored??env.REVOLUT_PRO_PRODUCTS_JSON??JSON.stringify(bundledCatalog);
 try{return proCatalogSchema.parse(JSON.parse(raw));}catch{throw new HttpError(503,'Neplatná konfigurácia Revolut Pro produktov.');}
}
function available(product){return product.active&&(!product.expires_at||Date.parse(product.expires_at)>Date.now());}
function publicProduct(product){return {id:product.id,name:product.name,description:product.description,amount_cents:product.amount_cents,currency:product.currency,checkout_path:'/pay/revolut-pro/'+product.id};}
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
export async function handleRevolutProPublic(request,env){
 const url=new URL(request.url),path=url.pathname;
 const checkout=path.match(/^\/pay\/revolut-pro\/([a-z0-9][a-z0-9_-]{0,79})$/);
 const listing=path==='/api/payments/revolut-pro';
 if(!checkout&&!listing)return null;
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 const data=await catalog(env);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 if(listing)return Response.json({provider:'revolut-pro',mode:'live-payment-links',products:data.products.filter(available).map(publicProduct),payment_status:'not_checked',automatic_payment_verification:false},{headers});
 const product=data.products.find(p=>p.id===checkout[1]&&available(p));
 if(!product)throw new HttpError(404,'Platobný odkaz nie je dostupný.');
 // The destination is owner-configured and validated; a URL query cannot replace it.
 return new Response(null,{status:302,headers:{...headers,Location:product.payment_url}});
}
