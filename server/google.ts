import express from 'express';
import {OAuth2Client} from 'google-auth-library';
import {randomUUID} from 'node:crypto';
import {pool} from './공통';
declare module 'express-session' { interface SessionData { googleState?:string; } }
const google=express.Router();
const {GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI}=process.env;
const client=new OAuth2Client(GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI);
const enabled=Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
google.get('/api/auth/providers',(_req,res)=>res.json({google:enabled}));
google.get('/api/auth/google', (req,res)=>{
 if(!enabled){res.status(503).json({error:'Google 로그인이 아직 설정되지 않았습니다.'});return;}
 const state=randomUUID();req.session.googleState=state;
 res.redirect(client.generateAuthUrl({scope:['openid','email','profile'],state}));
});
google.get('/api/auth/google/callback', async(req,res)=>{
 const state=req.session.googleState;delete req.session.googleState;
 if(!state||state!==req.query.state||typeof req.query.code!=='string'){res.redirect('/?google=retry');return;}
 try{
 const {tokens}=await client.getToken(req.query.code);
 if(!tokens.id_token)throw Error();
 const payload=(await client.verifyIdToken({idToken:tokens.id_token,audience:GOOGLE_CLIENT_ID})).getPayload();
 if(!payload?.sub||!payload.email_verified||!payload.email)throw Error();
 const result=await pool.query('INSERT INTO users(id,google_subject,email,name) VALUES($1,$2,$3,$4) ON CONFLICT(google_subject) DO UPDATE SET google_subject=excluded.google_subject RETURNING id',[randomUUID(),payload.sub,payload.email.toLowerCase(),payload.name||payload.email]);
 await new Promise<void>((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
 req.session.userId=result.rows[0].id;res.redirect('/');
 }catch{res.redirect('/?google=retry');}
});
export default google;
