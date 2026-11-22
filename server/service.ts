import express from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {auth,design,pool,price,transaction} from './공통';

const api=express.Router();
const id=z.string().uuid();
const text=(length:number)=>z.string().trim().min(1).max(length);
const phone=z.string().regex(/^0[0-9-]{9,13}$/);
const count=z.number().int().min(0).max(1000000);
const admin:express.RequestHandler=async(req,res,next)=>{
 const user=await pool.query("SELECT role FROM users WHERE id=$1",[req.session.userId]);
 if(user.rows[0]?.role!=='ADMIN'){res.status(403).json({error:'관리자 권한이 필요합니다.'});return;}
 next();
};
api.use('/api/admin',auth,admin);
api.patch('/api/me',auth,async(q,r)=>{
 const data=z.object({name:text(40),phone}).parse(q.body);
 r.json((await pool.query('UPDATE users SET name=$1,phone=$2 WHERE id=$3 RETURNING name,email,phone',[data.name,data.phone,q.session.userId])).rows[0]);
});
api.get('/api/addresses',auth,async(q,r)=>r.json((await pool.query('SELECT * FROM user_addresses WHERE owner_id=$1',[q.session.userId])).rows));
api.post('/api/addresses',auth,async(q,r)=>{
 const b=z.object({recipient:text(50),phone,address:text(300)}).parse(q.body);
 const row=await pool.query('INSERT INTO user_addresses VALUES($1,$2,$3,$4,$5) RETURNING id',[randomUUID(),q.session.userId,b.recipient,b.phone,b.address]);r.status(201).json(row.rows[0]);
});
api.delete('/api/addresses/:id',auth,async(q,r)=>{await pool.query('DELETE FROM user_addresses WHERE id=$1 AND owner_id=$2',[id.parse(q.params.id),q.session.userId]);r.json({ok:true});});
api.get('/api/sizes',async(_q,r)=>r.json((await pool.query('SELECT * FROM size_options ORDER BY capacity')).rows));
api.put('/api/admin/sizes/:size',async(q,r)=>{
 const b=z.object({capacity:z.number().int().min(1).max(18),fee:count}).parse(q.body);
 await pool.query('INSERT INTO size_options VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET capacity=excluded.capacity,fee=excluded.fee',[text(30).parse(q.params.size),b.capacity,b.fee]);r.json({ok:true});
});
api.get('/api/admin/catalog',async(_q,r)=>r.json((await pool.query('SELECT * FROM catalog ORDER BY id')).rows));
api.post('/api/admin/catalog',async(q,r)=>{
 const b=z.object({id:z.string().regex(/^[a-z0-9_]{1,48}$/),name:text(80),category:z.enum(['FLOWER','WRAPPING','RIBBON']),price:count,stock:count,image:z.string().regex(/^\/assets\/[a-z0-9_-]+\.(webp|png)$/),tags:z.array(z.enum(['인기','시즌'])).max(2).default([])}).parse(q.body);
 await pool.query('INSERT INTO catalog(id,name,category,price,stock,image,tags) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.id,b.name,b.category,b.price,b.stock,b.image,b.tags]);r.status(201).json({id:b.id});
});
api.patch('/api/admin/catalog/:id',async(q,r)=>{
 const b=z.object({stock:count.optional(),price:count.optional()}).refine(v=>v.stock!==undefined||v.price!==undefined).parse(q.body);
 const row=await pool.query('UPDATE catalog SET stock=COALESCE($1,stock),price=COALESCE($2,price) WHERE id=$3 RETURNING id',[b.stock,b.price,q.params.id]);if(!row.rowCount)throw Error('상품을 찾을 수 없습니다.');r.json(row.rows[0]);
});
api.post('/api/designs/quote',async(q,r)=>{const draft=design.parse(q.body);const {amount}=await transaction(c=>price(c,draft));r.json({amount});});
api.post('/api/designs/:id/duplicate',auth,async(q,r)=>{
 const copy=randomUUID();await transaction(async c=>{
 const source=id.parse(q.params.id);
 const found=await c.query('SELECT id FROM bouquet_designs WHERE id=$1 AND owner_id=$2 FOR UPDATE',[source,q.session.userId]);if(!found.rowCount)throw Error('디자인을 찾을 수 없습니다.');
 await c.query("INSERT INTO bouquet_designs(id,owner_id,name,size,wrapping,ribbon) SELECT $1,owner_id,left(name,56)||' 복사본',size,wrapping,ribbon FROM bouquet_designs WHERE id=$2",[copy,source]);
 await c.query('INSERT INTO design_elements SELECT gen_random_uuid(),$1,catalog_id,x,y,length,rotation,layer FROM design_elements WHERE design_id=$2',[copy,source]);});r.status(201).json({id:copy});
});
api.patch('/api/cart/:id',auth,async(q,r)=>{
 const qty=z.number().int().min(1).max(20).parse(q.body.quantity);
 const result=await pool.query('UPDATE cart_items SET quantity=$1 WHERE id=$2 AND owner_id=$3 RETURNING quantity',[qty,id.parse(q.params.id),q.session.userId]);if(!result.rowCount)throw Error('항목을 찾을 수 없습니다.');r.json(result.rows[0]);
});
api.get('/api/admin/orders',async(_q,r)=>r.json((await pool.query('SELECT * FROM orders ORDER BY created_at DESC')).rows));
const previous:Record<string,string[]>={ORDER_CONFIRMED:['PAYMENT_COMPLETED','DEMO_CONFIRMED'],IN_PRODUCTION:['ORDER_CONFIRMED'],PREPARING_SHIPMENT:['IN_PRODUCTION'],IN_TRANSIT:['PREPARING_SHIPMENT'],DELIVERED:['IN_TRANSIT']};
api.patch('/api/admin/orders/:id/status',async(q,r)=>{
 const b=z.object({status:z.enum(['ORDER_CONFIRMED','IN_PRODUCTION','PREPARING_SHIPMENT','IN_TRANSIT','DELIVERED']),trackingNumber:text(80).optional()}).parse(q.body);
 const result=await pool.query('UPDATE orders SET status=$1,tracking_number=coalesce($2,tracking_number) WHERE id=$3 AND status=ANY($4) RETURNING status',[b.status,b.trackingNumber,id.parse(q.params.id),previous[b.status]]);if(!result.rowCount)throw Error('주문 상태 전환을 확인해주세요.');r.json(result.rows[0]);
});
api.get('/api/faqs',async(_q,r)=>r.json((await pool.query('SELECT * FROM faq_items ORDER BY category,question')).rows));
api.put('/api/admin/faqs/:id',async(q,r)=>{
 const b=z.object({category:text(60),question:text(300),answer:text(4000)}).parse(q.body);
 await pool.query('INSERT INTO faq_items VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET category=excluded.category,question=excluded.question,answer=excluded.answer',[id.parse(q.params.id),b.category,b.question,b.answer]);r.json({ok:true});
});
api.delete('/api/admin/faqs/:id',async(q,r)=>{await pool.query('DELETE FROM faq_items WHERE id=$1',[id.parse(q.params.id)]);r.json({ok:true});});
api.get('/api/inquiries',async(q,r)=>{
 const rows=await pool.query("SELECT id,title,body,answer,private FROM inquiries WHERE NOT private OR owner_id=$1 OR EXISTS(SELECT 1 FROM users WHERE id=$1 AND role='ADMIN') ORDER BY created_at DESC",[q.session.userId||null]);r.json(rows.rows);
});
api.post('/api/inquiries',auth,async(q,r)=>{
 const b=z.object({title:text(160),body:text(4000),private:z.boolean().default(true),orderId:id.optional()}).parse(q.body);
 const result=await pool.query('INSERT INTO inquiries(id,owner_id,title,body,private,order_id) SELECT $1,$2,$3,$4,$5,$6 WHERE $6::uuid IS NULL OR EXISTS(SELECT 1 FROM orders WHERE owner_id=$2 AND id=$6) RETURNING id',[randomUUID(),q.session.userId,b.title,b.body,b.private,b.orderId]);if(!result.rowCount)throw Error('본인 주문을 선택해주세요.');r.status(201).json(result.rows[0]);
});
api.patch('/api/admin/inquiries/:id/answer',async(q,r)=>{const result=await pool.query('UPDATE inquiries SET answer=$1 WHERE id=$2 RETURNING id',[text(4000).parse(q.body.answer),id.parse(q.params.id)]);if(!result.rowCount)throw Error('문의를 찾을 수 없습니다.');r.json(result.rows[0]);});
export default api;
