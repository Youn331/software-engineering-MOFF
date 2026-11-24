import google from "./google";
import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import path from "node:path";
import service from "./service";
import section0 from "./기능/회원과 꽃 재료/요청";
import section1 from "./기능/디자인 보관함/요청";
import section2 from "./기능/장바구니/요청";
import section3 from "./기능/주문과 결제/요청";
import {pool} from "./공통";
const app=express();
if (!process.env.SESSION_SECRET)
  throw new Error(
    "SESSION_SECRET is required. Copy .env.example to .env and configure it.",
  );
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:"],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    store: new (connectPg(session))({ pool }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400000 * 7,
    },
  }),
);
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD"].includes(req.method) && req.headers.origin) {
    const origin = new URL(req.headers.origin);
    if (origin.host !== req.headers.host)
      return res.status(403).json({ error: "요청 출처를 확인할 수 없습니다." });
  }
  next();
});
app.get("/health",async (_req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true, revision:process.env.RENDER_GIT_COMMIT});}catch{res.status(503).json({ok:false});}});
app.use(google,service);
app.use(section0);
app.use(section1);
app.use(section2);
app.use(section3);
app.use("/api",(_q,r)=>r.status(404).json({error:"API를 찾을 수 없습니다."}));
app.use(express.static(path.resolve("dist")));
app.get("/{*path}", (_q, r) => r.sendFile(path.resolve("dist/index.html")));
app.use(
  (
    e: unknown,
    _q: express.Request,
    r: express.Response,
    _n: express.NextFunction,
  ) => {
    
    r.status(e instanceof z.ZodError ? 400 : 409).json({
      error:
        e instanceof z.ZodError
          ? "입력값을 확인해주세요."
          : (e as { code?: string }).code === "23505"
            ? "이미 사용 중인 이메일입니다."
            : e instanceof Error && !("code" in e)
              ? e.message
              : "처리 중 문제가 발생했습니다. 다시 시도해주세요.",
    });
  },
);
const server=app.listen(
  Number(process.env.PORT) || 3001,
  process.env.HOST || "0.0.0.0",
  () => console.log("MOFF HTTP ready"),
);

for(const signal of ["SIGTERM","SIGINT"]){process.once(signal,()=>server.close(()=>void pool.end()));}
