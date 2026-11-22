import 'dotenv/config';import pg from 'pg';import {readFile} from 'node:fs/promises';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
await pool.query(await readFile(new URL('../db/001_initial.sql',import.meta.url),'utf8'));
await pool.query(await readFile(new URL('../db/002_service.sql',import.meta.url),'utf8'));
const items=[['f_gerbera','핑크 거베라',3000],['f_sunflower','해바라기',3500],['f_lily','화이트 히아신스',3000],['f_willow','버들강아지',2000],['f_sprig','연두 잎가지',1500],['w_kraft','크라프트 콘',3000],['w_lime','라임 메시 콘',4000],['w_black','블랙 메시 콘',4500],['w_cream','크림 메시 콘',4500],['w_mom','Dear Mom 백',3500],['w_dad','Dear Dad 백',3500]];
if(process.env.SEED_DEMO_CATALOG==='true') for(const [id,name,price] of items)await pool.query('INSERT INTO catalog(id,name,category,price,stock,image) VALUES($1,$2,$3,$4,100,$5) ON CONFLICT DO NOTHING',[id,name,String(id).startsWith('f_')?'FLOWER':'WRAPPING',price,`/assets/${id}.webp`]);
await pool.end();console.log('MOFF database migrated and seeded.');
