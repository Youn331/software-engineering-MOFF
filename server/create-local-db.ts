import 'dotenv/config';import pg from 'pg';
const u=new URL(process.env.DATABASE_URL!);u.pathname='/postgres';const p=new pg.Pool({connectionString:u.toString()});
if(!(await p.query("SELECT 1 FROM pg_database WHERE datname='moff'")).rowCount)await p.query('CREATE DATABASE moff');await p.end();
