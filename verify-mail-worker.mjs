import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

const worker=(await import('data:text/javascript;base64,'+Buffer.from(await readFile('cloudflare-mail-worker.js')).toString('base64'))).default;
const raw='From: person@example.com\r\nTo: hello@mqmr.bio\r\nSubject: hello\r\n\r\nhello';
let deliveries=[];
globalThis.fetch=async(url,options)=>{deliveries.push({url,...options});return {ok:true,status:200};};
const make=(to='hello@mqmr.bio',size=raw.length)=>({to,from:'person@example.com',rawSize:size,raw:new Blob([raw]).stream(),setReject(reason){this.rejected=reason;}});
const env={MAIL_INGEST_SECRET:'local-test-secret-not-a-real-credential'};
await worker.email(make(),env);await worker.email(make(),env);
assert.equal(deliveries.length,2);
assert.equal(JSON.parse(deliveries[0].body).id,JSON.parse(deliveries[1].body).id);
assert.equal(Buffer.from(JSON.parse(deliveries[0].body).raw,'base64').toString(),raw);
const {body,headers}=deliveries[0];const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.MAIL_INGEST_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
assert(await crypto.subtle.verify('HMAC',key,Buffer.from(headers['x-mail-signature'],'hex'),new TextEncoder().encode(headers['x-mail-timestamp']+'.'+body)));
const other=make('x@other.example');await worker.email(other,env);assert(other.rejected);
const big=make('x@mqmr.bio',11*1024*1024);await worker.email(big,env);assert(big.rejected);
await assert.rejects(()=>worker.email(make(),{}));
globalThis.fetch=async()=>({ok:false,status:503});await assert.rejects(()=>worker.email(make(),env));
console.log('Worker envelope, stable duplicate IDs, HMAC, domain/size rejection and delivery errors passed.');

