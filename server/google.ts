import express from 'express';
import {OAuth2Client} from 'google-auth-library';
import {randomUUID} from 'node:crypto';
import {pool} from './공통';
declare module 'express-session' { interface SessionData { googleState?:string; } }
const google=express.Router();
const {GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI}=process.env;
const client=new OAuth2Client(GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,GOOGLE_REDIRECT_URI);
google.get('/api/auth/google', (req,res)=>{
 if(!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET||!GOOGLE_REDIRECT_URI){res.status(503).json({error:'Google 로그인이 아직 설정되지 않았습니다.'});return;}
 const state=randomUUID();req.session.googleState=state;
 res.redirect(client.generateAuthUrl({scope:['openid','email','profile'],state}));
});
google.get('/api/auth/google/callback', async(req,res)=>{
 const state=req.session.googleState;delete req.session.googleState;
 if(!state||state!==req.query.state||typeof req.query.code!=='string'){res.status(400).json({error:'로그인 요청이 만료되었습니다.'});return;}
 try{
 const {tokens}=await client.getToken(req.query.code);
 if(!tokens.id_token)throw Error();
 const payload=(await client.verifyIdToken({idToken:tokens.id_token,audience:GOOGLE_CLIENT_ID})).getPayload();
 if(!payload?.sub||!payload.email_verified||!payload.email)throw Error();
 const result=await pool.query('INSERT INTO users(id,google_subject,email,name) VALUES($1,$2,$3,$4) ON CONFLICT(google_subject) DO UPDATE SET google_subject=excluded.google_subject RETURNING id',[randomUUID(),payload.sub,payload.email.toLowerCase(),payload.name||payload.email]);
 await new Promise<void>((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
 req.session.userId=result.rows[0].id;res.redirect('/');
 }catch{res.status(401).json({error:'Google 계정을 확인할 수 없습니다. 기존 이메일 계정은 기존 로그인 방식을 사용해주세요.'});}
});
export default google;
