import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import assets from "./assets.json";
import { rackMaterials } from "../../shared/rack-materials";
import "./style.css";
import "./atelier.css";
type Flower = {
  id: string;
  catalogId: string;
  x: number;
  y: number;
  length: number;
  rotation: number;
  layer: number;
};
type Design = {
  name: string;
  size: "S" | "M" | "L";
  wrapping: string;
  ribbon?: string | null;
  elements: Flower[];
};
type Item = {
  id: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
};
const names = [
  "핑크 거베라",
  "해바라기",
  "화이트 히아신스",
  "버들강아지",
  "연두 잎가지",
  "크라프트 콘",
  "라임 메시 콘",
  "블랙 메시 콘",
  "크림 메시 콘",
  "Dear Mom 백",
  "Dear Dad 백",
];
const ids = [
  "f_gerbera",
  "f_sunflower",
  "f_lily",
  "f_willow",
  "f_sprig",
  "w_kraft",
  "w_lime",
  "w_black",
  "w_cream",
  "w_mom",
  "w_dad",
];
const prices = [
  3000, 3500, 3000, 2000, 1500, 3000, 4000, 4500, 4500, 3500, 3500,
];
const sample = [...ids.map((id, i) => ({
  id,
  name: names[i],
  price: prices[i],
  available: true,
  category: id.startsWith("f_") ? "FLOWER" : "WRAPPING",
})), ...rackMaterials.map(item => ({ ...item, available: true }))];
const paperNames: Record<string, string> = {
  w_kraft: "크라프트", w_lime: "민트 그린", w_black: "블랙 도트",
  w_cream: "아이보리 도트", w_mom: "핑크 체크", w_dad: "버건디 크림",
  w_green_check: "연두색 체크무늬 꽃 포장지",
};
const sizedPapers = new Set(Object.keys(paperNames));
const img = (id: string) => {
  if (sizedPapers.has(id)) return `/atelier/${id}-M.webp`;
  if (ids.includes(id) || rackMaterials.some(item => item.id === id)) return `/atelier/${id}.webp`;
  return String((assets as Record<string, (string | number)[]>)[id]?.[0] || "");
};
const withPaperName = (item: Item) => ({ ...item, name: paperNames[item.id] ?? item.name });
const paperImage = (design: Design) => sizedPapers.has(design.wrapping)
  ? `/atelier/${design.wrapping}-${design.size}.webp`
  : img(design.wrapping);
// Bounds in percent of the supplied 1670 × 941 workroom photograph.
const displaySlots: [string, number, number, number, number][] = [
  ["w_lime", 7.1, 10.5, 5.1, 12.7], ["w_black", 17, 10.5, 4.6, 12.7],
  ["w_mom", 12.3, 10.5, 4.6, 12.7], ["w_dad", 26.4, 10.5, 4.8, 12.7],
  ["w_cream", 21.6, 10.5, 4.7, 12.7], ["w_kraft", 7.2, 45.4, 24.2, 15.5],
  ["r_lavender", 7.9, 27, 5.8, 5.3], ["r_sky", 14.2, 27, 5.6, 5.3],
  ["r_pink", 20.1, 27, 5.4, 5.3], ["r_ivory", 25.9, 27, 5.3, 5.3],
  ["w_green_check", 7.3, 36.2, 24.1, 8.2],
  ["f_yellow", 37.3, 5.5, 7.3, 18.3], ["f_lavender", 44.7, 5.5, 7, 18.3],
  ["f_bell", 51.8, 5.5, 7.1, 18.3], ["f_gerbera", 59, 7.8, 7.4, 16],
  ["f_pink", 37.3, 25.3, 7.3, 16], ["f_tulip", 44.7, 25.3, 7, 16],
  ["f_sunflower", 51.8, 25.3, 7.1, 16], ["f_sprig", 59, 25.3, 7, 16],
  ["f_spiral", 37.3, 43, 7.3, 16], ["f_lily", 44.7, 43, 7, 16],
  ["f_blue_rose", 51.8, 43, 7.1, 16], ["f_willow", 59, 42, 7.1, 17],
];
const won = (n: number) => n.toLocaleString() + "원";
const defaultSizes = {
  S: { min_flowers: 1, capacity: 1, fee: 3000 },
  M: { min_flowers: 2, capacity: 6, fee: 6000 },
  L: { min_flowers: 7, capacity: 12, fee: 10000 },
};
function countLabel({ min_flowers, capacity }: typeof defaultSizes.S) {
  return min_flowers === capacity ? `${capacity}송이` : `${min_flowers}~${capacity}송이`;
}
function flowerGroups(elements: Flower[]) {
  const groups = new Map<string, Flower[]>();
  for (const flower of elements) {
    const group = groups.get(flower.catalogId);
    if (group) group.push(flower);
    else groups.set(flower.catalogId, [flower]);
  }
  return [...groups.entries()];
}
const initial = (): Design => ({
  name: "",
  size: "M",
  wrapping: "w_kraft",
  elements: ["f_gerbera", "f_sunflower", "f_lily", "f_sprig"].map(
    (catalogId, i) => ({
      id: crypto.randomUUID(),
      catalogId,
      x: (i - 1.5) * 45,
      y: (i % 2) * 15,
      length: 1,
      rotation: (i - 1.5) * 12,
      layer: i,
    }),
  ),
});
async function api(url: string, method = "GET", data?: unknown) {
  const r = await fetch("/api/" + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "요청 실패");
  return j;
}
function Bouquet({
  design,
  small = false,
  onSelect,
  selected,
  onMove,
  angle = 0,
}: {
  design: Design;
  small?: boolean;
  onSelect?: (id: string) => void;
  selected?: string;
  onMove?: (id: string, x: number, y: number) => void;
  angle?: number;
}) {
  const drag = useRef<{
    id: string;
    cx: number;
    cy: number;
    x: number;
    y: number;
  } | null>(null);
  return (
    <div
      className={"bouquet " + (small ? "mini" : "")}
      style={{ transform: `rotateY(${angle}deg)` }}
    >
      {sizedPapers.has(design.wrapping) && (
        <img className={`wrapping paper-back size-${design.size}`} src={paperImage(design)} alt="" />
      )}
      {design.elements.map((f) => (
        <img
          key={f.id}
          className={"stem " + (f.id === selected ? "selected" : "")}
          src={img(f.catalogId)}
          alt={sample.find((i) => i.id === f.catalogId)?.name}
          draggable={false}
          style={{
            left: `calc(50% + ${f.x}px)`,
            bottom: `${70 - f.y}px`,
            height: 300 * f.length,
            zIndex: 20 + f.layer,
            transform: `translateX(-50%) translateZ(${f.layer * 3}px) rotate(${f.rotation}deg)`,
          }}
          onPointerDown={(e) => {
            if (!onMove) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: f.id,
              cx: e.clientX,
              cy: e.clientY,
              x: f.x,
              y: f.y,
            };
            onSelect?.(f.id);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d?.id === f.id)
              onMove?.(
                f.id,
                Math.max(-200, Math.min(200, d.x + e.clientX - d.cx)),
                Math.max(-150, Math.min(150, d.y + e.clientY - d.cy)),
              );
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        />
      ))}
      <img
        key={design.wrapping + design.size}
        className={`wrapping size-${design.size} ${sizedPapers.has(design.wrapping) ? "paper-front " + design.wrapping : ""}`}
        src={paperImage(design)}
        alt="선택한 포장지"
      />
      {design.ribbon && img(design.ribbon) && (
        <img key={design.ribbon} className={`bouquet-ribbon size-${design.size}`}
          src={img(design.ribbon)} alt={sample.find(i => i.id === design.ribbon)?.name || "선택한 리본"}
          draggable={false} />
      )}
    </div>
  );
}

type SavedDesign = Design & { id: string };
type CartItem = { id: string; snapshot: Design; quantity: number };
type OrderLine = {
  id?: string;
  snapshot: Design;
  quantity: number;
  unitPrice?: number;
};
type Order = {
  id: string;
  status: string;
  total: number;
  shipping: number;
  created_at: string;
  address: { name: string; phone: string; address: string; note: string };
  orderItems: OrderLine[];
};
type Checkout = {
  lines: OrderLine[];
  cartIds?: string[];
  from: string;
  requestKey: string;
};
const statusNames: Record<string, string> = {
  PAYMENT_PENDING: "결제 대기",
  DEMO_CONFIRMED: "시연 주문 접수",
  PAYMENT_COMPLETED: "결제 완료 · 제작 대기",
  ORDER_CONFIRMED: "주문 확인",
  IN_PRODUCTION: "제작 중",
  PREPARING_SHIPMENT: "배송 준비",
  IN_TRANSIT: "배송 중",
  DELIVERED: "배송 완료",
  CANCELLED: "취소 완료",
  CANCELLATION_PENDING: "취소 처리 중",
  PAYMENT_FAILED: "결제 실패",
};
const displayName = (d: Design) => d.name.trim() || "이름 없는 꽃다발";
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
function App() {
  const [sizes, setSizes] = useState(defaultSizes);
  const [googleEnabled,setGoogleEnabled]=useState(false);
  const [d, setD] = useState<Design>(initial),
    [catalog, setCatalog] = useState<Item[]>(() => sample.map(withPaperName)),
    [user, setUser] = useState<{ name: string } | null>(null);
  const [tab, setTab] = useState("FLOWER"),
    [page, setPage] = useState("studio"),
    [selected, setSelected] = useState(""),
    [angle, setAngle] = useState(0),
    [door, setDoor] = useState(true),
    [modal, setModal] = useState(""),
    [message, setMessage] = useState("");
  const [saved, setSaved] = useState<SavedDesign[]>([]),
    [cart, setCart] = useState<CartItem[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [busy, setBusy] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null);
  const [designSelection, setDesignSelection] = useState<string[]>([]),
    [cartSelection, setCartSelection] = useState<string[]>([]),
    [checkout, setCheckout] = useState<Checkout | null>(null),
    [detail, setDetail] = useState<Order | null>(null);
  const [materialList, showMaterialList] = useState(false);
  const [raised, setRaised] = useState(false);
  const [draggingItem, setDraggingItem] = useState("");
  const liftStart = useRef(0);
  const running = useRef(false);
  const current = d.elements.find((f) => f.id === selected);
  const estimate = (design: Design) =>
    design.elements.reduce(
      (n, e) => n + (catalog.find((i) => i.id === e.catalogId)?.price || 0),
      catalog.find((i) => i.id === design.wrapping)?.price || 0,
    ) + (catalog.find(i => i.id === design.ribbon)?.price || 0)
      + sizes[design.size].fee;
  const price = estimate(d);
  const composition = (design: Design) => {
    return (
      flowerGroups(design.elements)
        .map(([id, flowers]) => `${catalog.find(i => i.id === id)?.name || id} ${flowers.length}송이`)
        .join(" · ") +
      ` / ${catalog.find((i) => i.id === design.wrapping)?.name || "포장지"} · ${design.size}` +
      (design.ribbon ? " · " + (catalog.find(i => i.id === design.ribbon)?.name || "리본") : "")
    );
  };
  const navigate = (p: string) => {
    setPage(p);
    window.history.pushState(null, "", "#" + p);
    window.scrollTo(0, 0);
  };
  const run = async (fn: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const needUser = (fn: () => Promise<void>) => {
    if (!user) {
      setModal("login");
      return;
    }
    void run(fn);
  };
  const load = async (p: string) => {
    if (p === "designs") {
      setSaved(await api("designs"));
      setDesignSelection([]);
    }
    if (p === "cart") {
      setCart(await api("cart"));
      setCartSelection([]);
    }
    if (p === "orders") setOrders(await api("orders"));
  };
  const go = (p: string) => {
    if (p !== "studio" && !user) {
      setModal("login");
      return;
    }
    void run(async () => {
      await load(p);
      if (p === "studio" && editingId) {
        setD(initial());
        setEditingId(null);
      }
      navigate(p);
    });
  };
  useEffect(() => {
    api("auth/providers").then(v=>setGoogleEnabled(v.google===true)).catch(()=>{});
    api("sizes").then((options: (typeof defaultSizes.S & { id: string })[]) => {
      const updated = { ...defaultSizes };
      for (const option of options) {
        const id = option.id;
        if (id === "S" || id === "M" || id === "L") updated[id] = { ...defaultSizes[id], ...option };
      }
      setSizes(updated);
    }).catch(() => {});
    if(new URLSearchParams(location.search).get("google")==="retry"){
      history.replaceState(null,"",location.pathname+location.hash);
      setModal("login");
      setMessage("Google 인증을 완료하지 못했어요. 기존 이메일로 가입했다면 이메일 로그인을 이용해주세요.");
    }
    api("catalog")
      .then((c) => {
        setCatalog(c.map(withPaperName));
      })
      .catch(() =>
        setMessage("서버에 연결할 수 없습니다. 서버 실행 상태를 확인해주세요."),
      );
    api("me")
      .then(async (u) => {
        setUser(u);
        const p = location.hash.slice(1);
        if (u && ["designs", "cart", "orders"].includes(p)) {
          await load(p);
          setPage(p);
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const back = () => {
      const p = location.hash.slice(1) || "studio";
      if (["studio", "designs", "cart", "orders"].includes(p)) {
        setPage(p);
        void run(() => load(p));
      } else if (p === "checkout" && checkout) setPage(p);
      else if (p === "order-detail" && detail) setPage(p);
      else setPage("studio");
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [checkout, detail]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(t);
  }, [message]);
  const change = (p: Partial<Flower>) =>
    setD((v) => ({
      ...v,
      elements: v.elements.map((f) => (f.id === selected ? { ...f, ...p } : f)),
    }));
  const validCount = (design: Design) => {
    const rule = sizes[design.size];
    return design.elements.length >= rule.min_flowers && design.elements.length <= rule.capacity;
  };
  const selectSize = (size: Design["size"]) => {
    if (d.elements.length > sizes[size].capacity)
      return setMessage(`${size} 사이즈는 최대 ${sizes[size].capacity}송이예요. 꽃을 줄인 뒤 선택해주세요.`);
    setD({ ...d, size });
  };
  const add = (item: Item) => {
    if (!item.available) return;
    if (item.category === "RIBBON") {
      setD(v => ({ ...v, ribbon: item.id }));
      return;
    }
    if (item.category === "WRAPPING") {
      setD({ ...d, wrapping: item.id });
      return;
    }
    if (d.elements.length >= sizes[d.size].capacity) {
      setMessage("현재 사이즈의 최대 꽃 수에 도달했어요.");
      return;
    }
    const id = crypto.randomUUID();
    setD({
      ...d,
      elements: [
        ...d.elements,
        {
          id,
          catalogId: item.id,
          x: (Math.random() - 0.5) * 120,
          y: 0,
          length: 1,
          rotation: (Math.random() - 0.5) * 30,
          layer: d.elements.length,
        },
      ],
    });
    setSelected(id);
  };
  const addCart = async (ids: string[]) => {
    const result = await api("cart/bulk", "POST", { ids });
    setMessage(`${result.count}개의 디자인을 장바구니에 담았어요.`);
    setDesignSelection([]);
  };
  const startCheckout = (
    lines: OrderLine[],
    from: string,
    cartIds?: string[],
  ) => {
    const invalid = lines.find(line => !validCount(line.snapshot));
    if (invalid) return setMessage(`${invalid.snapshot.size} 사이즈는 ${countLabel(sizes[invalid.snapshot.size])}를 담아야 주문할 수 있어요.`);
    if (!lines.length) return setMessage("주문할 꽃다발을 선택해주세요.");
    setCheckout({
      lines: structuredClone(lines),
      from,
      cartIds,
      requestKey: crypto.randomUUID(),
    });
    navigate("checkout");
  };
  const checkoutAmount =
    checkout?.lines.reduce(
      (n, l) => n + estimate(l.snapshot) * l.quantity,
      0,
    ) || 0;
  const recent = orders[0];
  return (
    <>
      <header>
        <a className="logo" onClick={() => go("studio")}>
          <img src="/atelier/logo.webp" alt="MOFF" />
        </a>
        <nav>
          {[
            ["studio", "나의 꽃집"],
            ["designs", "My Design"],
            ["cart", "장바구니"],
            ["orders", "주문 내역"],
          ].map(([id, label]) => (
            <button
              key={id}
              disabled={busy}
              className={page === id ? "active" : ""}
              onClick={() => go(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className="account"
          disabled={busy}
          onClick={() =>
            user
              ? run(async () => {
                  await api("logout", "POST");
                  setUser(null);
                  setSaved([]);
                  setCart([]);
                  setOrders([]);
                  setCheckout(null);
                  setDetail(null);
                  setEditingId(null);
                  setD(initial());
                  navigate("studio");
                })
              : setModal("login")
          }
        >
          {user ? user.name + " · 로그아웃" : "로그인 / 회원가입"}
        </button>
      </header>
      {page === "studio" ? (
        <>
          <main className="atelier">
            <section className="atelier-room" aria-label="모루꽃 작업대">
              {displaySlots.map(([id, left, top, width, height]) => {
                const item = catalog.find(i => i.id === id);
                if (!item) return null;
                return (
                  <button key={id} disabled={!item.available || !door}
                    className={"shelf-pick " + (id === d.wrapping || id === d.ribbon || current?.catalogId === id ? "picked" : "")}
                    style={{ "--slot-left": left + "%", left: left + "%", top: top + "%", width: width + "%", height: height + "%" } as React.CSSProperties}
                    aria-label={item.name}
                    draggable={item.available && door}
                    onDragStart={e => { e.dataTransfer.setData("text/plain", id); setDraggingItem(id); }}
                    onDragEnd={() => setDraggingItem("")}
                    onClick={() => add(item)} />
                );
              })}
              {materialList && <aside className="fridge atelier-list">
              <div className="fridge-top">
                <span>MOFF FLOWER MARKET</span>
                <i>● 04°C</i>
              </div>
              <div className="categories">
                {[
                  ["FLOWER", "꽃 냉장고"],
                  ["WRAPPING", "포장 선반"],
                  ["RIBBON", "리본"],
                  ["SIZE", "사이즈"],
                ].map(([k, n]) => (
                  <button
                    key={k}
                    className={tab === k ? "active" : ""}
                    onClick={() => {
                      setTab(k);
                      setDoor(true);
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className={"glass " + (door ? "opened" : "")}>
                <button className="door-toggle" onClick={() => setDoor(!door)}>
                  {door ? "유리문 닫기" : "냉장고 열기"} ↗
                </button>
                {tab === "SIZE" ? (
                  <div className="sizes">
                    {(["S", "M", "L"] as const).map((s) => (
                      <button
                        className={d.size === s ? "active" : ""}
                        key={s}
                        onClick={() => selectSize(s)}
                      >
                        <b>{s}</b>
                        <span>{countLabel(sizes[s])}</span>
                        <small>+ {won(sizes[s].fee)}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="shelves">
                    {catalog
                      .filter((i) => i.category === tab)
                      .map((item) => (
                        <button
                          key={item.id}
                          disabled={!door || !item.available}
                          className="ingredient"
                          onClick={() => add(item)}
                          draggable={door}
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", item.id)
                          }
                        >
                          <div className="bucket">
                            <img src={img(item.id)} alt={item.name} />
                            {tab === "FLOWER" && <span className="vase" />}
                          </div>
                          <small>
                            {item.available ? won(item.price) : "SOLD OUT"}
                          </small>
                          <span className="plus">+</span>
                        </button>
                      ))}
                  </div>
                )}
                {!door && (
                  <div className="closed-door" onClick={() => setDoor(true)}>
                    <span>
                      MOFF
                      <br />
                      <small>클릭해서 문을 열어주세요</small>
                    </span>
                  </div>
                )}
              </div>
              <div className="fridge-bottom">
                ✳ Fresh ideas, forever flowers.
              </div>
            </aside>}
            <section
              aria-label="꽃다발 배치 영역"
              className={`workroom atelier-mat ${raised ? "raised" : ""} ${draggingItem ? "receiving" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const item = catalog.find(
                  (i) => i.id === e.dataTransfer.getData("text/plain"),
                );
                setDraggingItem("");
                if (item && door) add(item);
              }}
            >
              <button className="lift-handle" aria-pressed={raised}
                onPointerDown={e => { liftStart.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
                onPointerUp={e => { const dy = e.clientY - liftStart.current; if (Math.abs(dy) > 8) setRaised(dy < 0); }}
                onClick={e => { if (e.detail === 0 || Math.abs(e.clientY - liftStart.current) <= 8) setRaised(!raised); }}>
                {raised ? "꽃다발 내리기 ↓" : "꽃다발 올리기 ↑"}
              </button>
              <div className="scene">
                <Bouquet
                  design={d}
                  selected={selected}
                  angle={angle}
                  onSelect={setSelected}
                  onMove={(id, x, y) =>
                    setD((v) => ({
                      ...v,
                      elements: v.elements.map((f) =>
                        f.id === id ? { ...f, x, y } : f,
                      ),
                    }))
                  }
                />
              </div>
              <div className="scene-tools">
                <button onClick={() => setAngle(Math.max(-50, angle - 10))}>
                  ↶
                </button>
                <span>{angle}°</span>
                <button onClick={() => setAngle(Math.min(50, angle + 10))}>
                  ↷
                </button>
                <button
                  onClick={() => {
                    setAngle(0);
                    setSelected("");
                  }}
                >
                  정면
                </button>
              </div>
              <div className="instruction">
                꽃을 드래그해 배치해보세요 · {d.elements.length} /{" "}
                {sizes[d.size].capacity}송이
              </div>
            </section>
            </section>
            <div className="atelier-flower-tools">
              <button className="material-toggle" aria-expanded={materialList}
                onClick={() => showMaterialList(!materialList)}>재료 목록 {materialList ? "닫기" : "열기"}</button>
              {current ? (
                <div className="edit-controls">
                  <b>선택한 꽃 조절</b>
                  {[
                    ["length", "줄기 길이", 0.5, 1.7, 0.01],
                    ["rotation", "기울기", -90, 90, 1],
                    ["layer", "앞뒤 레이어", -30, 30, 1],
                  ].map(([k, label, min, max, step]) => (
                    <label key={String(k)}>
                      {label}
                      <output>
                        {Number(current[k as keyof Flower]).toFixed(
                          k === "length" ? 2 : 0,
                        )}
                      </output>
                      <input
                        aria-label={String(label)}
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={current[k as keyof Flower]}
                        onChange={(e) =>
                          change({ [k]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  꽃을 선택하면 길이와 레이어를 조절할 수 있어요.
                </p>
              )}
            </div>
            <aside className="receipt atelier-receipt">
              <div className="receipt-details">
              <h1>{editingId ? "꽃다발 디자인 수정" : "나의 꽃다발"}</h1>
              <input
                className="design-name"
                aria-label="디자인 이름"
                placeholder="디자인 이름을 작성하세요."
                value={d.name}
                maxLength={60}
                onChange={(e) => setD({ ...d, name: e.target.value })}
              />
              <div className="receipt-sizes" aria-label="꽃다발 사이즈">
                    {(["S", "M", "L"] as const).map((s) => (
                      <button
                        className={d.size === s ? "active" : ""}
                        key={s}
                        onClick={() => selectSize(s)}
                      >
                        <b>{s}</b>
                        <small>{won(sizes[s].fee)}</small>
                        <small>{countLabel(sizes[s])}</small>
                      </button>
                    ))}
              </div>
              <div className="paper-line"><span>포장지</span><img src={paperImage(d)} alt={catalog.find(i => i.id === d.wrapping)?.name} /></div>
              <div className="composition">
                {flowerGroups(d.elements).map(([id, flowers]) => {
                  const name = catalog.find(item => item.id === id)?.name ?? id;
                  const index = flowers.findIndex(f => f.id === selected);
                  const removeId = (flowers[index] ?? flowers[flowers.length - 1]).id;
                  return (
                    <div className="flower-row" key={id}>
                      <button className={index >= 0 ? "active" : ""}
                        onClick={() => setSelected(flowers[(index + 1) % flowers.length].id)}>
                        <img src={img(id)} alt="" /><span>{name} × {flowers.length}</span>
                      </button>
                      <button className="remove-flower" aria-label={name + " 한 송이 빼기"}
                        onClick={() => setD(v => ({ ...v, elements: v.elements.filter(f => f.id !== removeId) }))}>×</button>
                    </div>
                  );
                })}
                {!validCount(d) && <p className="muted" role="status">
                  {d.size} 사이즈는 {countLabel(sizes[d.size])}를 담아야 저장하거나 주문할 수 있어요. 현재 {d.elements.length}송이예요.
                </p>}
              </div>
              </div>
              <div className="receipt-bottom">
              <div className="total">
                <span>꽃다발 예상 금액</span>
                <b>{won(price)}</b>
              </div>
              <p className="shipping">3만원 이상 무료배송 · 제작 후 배송</p>
              <button
                className="primary"
                disabled={busy || !validCount(d)}
                onClick={() =>
                  needUser(async () => {
                    if (!d.elements.length)
                      throw Error("꽃을 먼저 골라주세요.");
                    const result = await api(
                      editingId ? "designs/" + editingId : "designs",
                      editingId ? "PUT" : "POST",
                      d,
                    );
                    setD({ ...d, name: result.name });
                    setSaved(await api("designs"));
                    setEditingId(null);
                    setDesignSelection([]);
                    navigate("designs");
                    setMessage("디자인을 저장했어요.");
                  })
                }
              >
                {editingId ? "수정 내용 저장" : "♡ My Design에 저장"}
              </button>
              {editingId ? (
                <button className="reset" onClick={() => go("designs")}>
                  수정 취소 · 갤러리로 돌아가기
                </button>
              ) : (
                <>
                  <div className="actions">
                    <button
                      disabled={busy || !validCount(d)}
                      onClick={() =>
                        needUser(async () => {
                          const save = window.confirm("주문 전에 My Design에도 저장할까요? 취소를 누르면 주문서로 바로 이동합니다.");
                          const snapshot = save ? {...d, name: (await api("designs","POST",d)).name} : d;
                          startCheckout([{snapshot,quantity:1}], "studio");
                        })
                      }
                    >
                      바로 주문 →
                    </button>
                  </div>
                  <button
                    className="reset"
                    onClick={() => {
                      setD(initial());
                      setSelected("");
                      setAngle(0);
                    }}
                  >
                    새 꽃다발 만들기
                  </button>
                </>
              )}
              </div>
            </aside>
          </main>
        </>
      ) : (
        <main className="collection">
          <span className="eyebrow">YOUR MOFF COLLECTION</span>
          <h1>
            {
              (
                {
                  designs: "My Design",
                  cart: "장바구니",
                  orders: "주문 내역",
                  checkout: "주문서 작성",
                  "order-detail": "주문 상세",
                } as Record<string, string>
              )[page]
            }
          </h1>
          {page === "designs" && (
            <>
              <p>
                마음에 드는 디자인을 골라 장바구니에 담거나 바로 주문하세요.
              </p>
              <div className="selection-bar">
                <label>
                  <input
                    type="checkbox"
                    aria-label="디자인 전체 선택"
                    checked={
                      saved.length > 0 &&
                      designSelection.length === saved.length
                    }
                    onChange={(e) =>
                      setDesignSelection(
                        e.target.checked ? saved.map((s) => s.id) : [],
                      )
                    }
                  />{" "}
                  전체 선택 · {designSelection.length}개
                </label>
                <div>
                  <button
                    disabled={busy || !designSelection.length}
                    onClick={() =>
                      run(async () => {
                        await api("designs/bulk-delete", "POST", {
                          ids: designSelection,
                        });
                        setSaved(await api("designs"));
                        setDesignSelection([]);
                        setMessage("선택한 디자인을 삭제했어요.");
                      })
                    }
                  >
                    선택 삭제
                  </button>
                  <button
                    className="filled"
                    disabled={busy || !designSelection.length}
                    onClick={() => run(() => addCart(designSelection))}
                  >
                    선택 장바구니 담기
                  </button>
                </div>
              </div>
              <div className="cards">
                {saved.map((s) => (
                  <article
                    key={s.id}
                    className={
                      designSelection.includes(s.id) ? "checked-card" : ""
                    }
                  >
                    <label className="card-check">
                      <input
                        type="checkbox"
                        aria-label={s.name + " 선택"}
                        checked={designSelection.includes(s.id)}
                        onChange={() =>
                          setDesignSelection(toggle(designSelection, s.id))
                        }
                      />
                    </label>
                    <Bouquet design={s} small />
                    <h3>{s.name}</h3>
                    <p>{composition(s)}</p>
                    <div className="card-actions">
                      <button
                        disabled={busy}
                        onClick={() => {
                          setD(structuredClone(s));
                          setEditingId(s.id);
                          setSelected("");
                          setAngle(0);
                          navigate("studio");
                        }}
                      >
                        수정
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => run(() => addCart([s.id]))}
                      >
                        장바구니 담기
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          startCheckout(
                            [{ snapshot: s, quantity: 1 }],
                            "designs",
                          )
                        }
                      >
                        바로 주문
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!saved.length && (
                <p className="empty">
                  저장한 디자인이 없어요. 나의 꽃집에서 첫 꽃다발을
                  만들어보세요.
                </p>
              )}
            </>
          )}
          {page === "cart" && (
            <>
              <p>담아둔 꽃다발의 구성을 확인하고 함께 주문하세요.</p>
              <div className="selection-bar">
                <label>
                  <input
                    type="checkbox"
                    aria-label="장바구니 전체 선택"
                    checked={
                      cart.length > 0 && cartSelection.length === cart.length
                    }
                    onChange={(e) =>
                      setCartSelection(
                        e.target.checked ? cart.map((c) => c.id) : [],
                      )
                    }
                  />{" "}
                  전체 선택 · {cartSelection.length}개
                </label>
                <button
                  className="filled"
                  disabled={busy || !cartSelection.length}
                  onClick={() =>
                    startCheckout(
                      cart.filter((c) => cartSelection.includes(c.id)),
                      "cart",
                      cartSelection,
                    )
                  }
                >
                  선택 주문하기
                </button>
              </div>
              <div className="item-list">
                {cart.map((c) => (
                  <article className="list-row" key={c.id}>
                    <input
                      type="checkbox"
                      aria-label={c.snapshot.name + " 선택"}
                      checked={cartSelection.includes(c.id)}
                      onChange={() =>
                        setCartSelection(toggle(cartSelection, c.id))
                      }
                    />
                    <div className="list-preview">
                      <Bouquet design={c.snapshot} small />
                    </div>
                    <div className="row-copy">
                      <h3>{displayName(c.snapshot)}</h3>
                      <p>{composition(c.snapshot)}</p>
                      <small>수량 {c.quantity}개</small>
                    </div>
                    <strong>{won(estimate(c.snapshot) * c.quantity)}</strong>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api("cart/" + c.id, "DELETE");
                          setCart(cart.filter((x) => x.id !== c.id));
                          setCartSelection(
                            cartSelection.filter((id) => id !== c.id),
                          );
                        })
                      }
                    >
                      삭제
                    </button>
                  </article>
                ))}
              </div>
              {cart.length > 0 && (
                <div className="cart-summary">
                  <span>
                    선택 상품{" "}
                    {won(
                      cart
                        .filter((c) => cartSelection.includes(c.id))
                        .reduce(
                          (n, c) => n + estimate(c.snapshot) * c.quantity,
                          0,
                        ),
                    )}{" "}
                    · 배송비는 주문서에서 확인
                  </span>
                  <button
                    className="filled"
                    disabled={busy || !cartSelection.length}
                    onClick={() =>
                      startCheckout(
                        cart.filter((c) => cartSelection.includes(c.id)),
                        "cart",
                        cartSelection,
                      )
                    }
                  >
                    주문하기
                  </button>
                </div>
              )}
              {!cart.length && (
                <p className="empty">
                  장바구니가 비어 있어요. My Design에서 꽃다발을 담아주세요.
                </p>
              )}
            </>
          )}
          {page === "checkout" && checkout && (
            <div className="checkout-layout">
              <form
                className="checkout-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void run(async () => {
                    const result = await api("orders", "POST", {
                      requestKey: checkout.requestKey,
                      ...(checkout.cartIds
                        ? { cartIds: checkout.cartIds }
                        : { design: checkout.lines[0].snapshot }),
                      address: Object.fromEntries(data),
                    });
                    setOrders(await api("orders"));
                    setCatalog(await api("catalog"));
                    setCartSelection([]);
                    setCheckout(null);
                    navigate("orders");
                    setMessage("주문이 완료되었어요. " + won(result.total));
                  });
                }}
              >
                <h2>배송지 정보</h2>
                <label>
                  받는 분
                  <input
                    name="name"
                    autoComplete="shipping name"
                    required
                    maxLength={50}
                  />
                </label>
                <label>
                  연락처
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="shipping tel"
                    placeholder="010-1234-5678"
                    pattern="0[0-9\-]{9,13}"
                    required
                  />
                </label>
                <label>
                  배송 주소
                  <input
                    name="address"
                    autoComplete="shipping street-address"
                    placeholder="주소와 상세 주소를 입력해주세요"
                    required
                    minLength={5}
                    maxLength={300}
                  />
                </label>
                <label>
                  배송 요청사항
                  <input name="note" maxLength={300} placeholder="선택 입력" />
                </label>
                <p className="payment-note">
                  수업 시연용 모의 결제입니다. 실제 금액은 청구되지 않아요.
                </p>
                <button className="primary" disabled={busy}>
                  {busy ? "주문 처리 중…" : "모의 결제하고 주문 완료"}
                </button>
                <button
                  type="button"
                  className="reset"
                  disabled={busy}
                  onClick={() => go(checkout.from)}
                >
                  이전 화면으로 돌아가기
                </button>
              </form>
              <aside className="checkout-summary">
                <h2>주문할 꽃다발</h2>
                {checkout.lines.map((l, i) => (
                  <div className="summary-line" key={i}>
                    <h3>{displayName(l.snapshot)}</h3>
                    <p>{composition(l.snapshot)}</p>
                    <span>
                      {l.quantity}개 · {won(estimate(l.snapshot) * l.quantity)}
                    </span>
                  </div>
                ))}
                <dl>
                  <div>
                    <dt>상품 금액</dt>
                    <dd>{won(checkoutAmount)}</dd>
                  </div>
                  <div>
                    <dt>배송비</dt>
                    <dd>{won(checkoutAmount >= 30000 ? 0 : 3000)}</dd>
                  </div>
                  <div className="summary-total">
                    <dt>예상 결제 금액</dt>
                    <dd>
                      {won(
                        checkoutAmount + (checkoutAmount >= 30000 ? 0 : 3000),
                      )}
                    </dd>
                  </div>
                </dl>
                <p>최종 금액과 재고는 주문 시 확인됩니다.</p>
              </aside>
            </div>
          )}
          {page === "orders" && (
            <>
              {recent && (
                <section className="delivery">
                  <span className="eyebrow">LATEST ORDER</span>
                  <h2>최근 주문 배송 상태</h2>
                  <strong>{statusNames[recent.status] || recent.status}</strong>
                  <p>
                    {new Date(recent.created_at).toLocaleString("ko-KR")} ·{" "}
                    {recent.orderItems[0].snapshot.name}
                  </p>
                  {![
                    "CANCELLED",
                    "PAYMENT_FAILED",
                    "CANCELLATION_PENDING",
                  ].includes(recent.status) && (
                    <ol className="delivery-steps">
                      {[
                        "결제 완료",
                        "제작 중",
                        "배송 준비",
                        "배송 중",
                        "배송 완료",
                      ].map((label, i) => {
                        const step =
                          (
                            {
                              PAYMENT_COMPLETED: 0,
                              ORDER_CONFIRMED: 0,
                              IN_PRODUCTION: 1,
                              PREPARING_SHIPMENT: 2,
                              IN_TRANSIT: 3,
                              DELIVERED: 4,
                            } as Record<string, number>
                          )[recent.status] ?? -1;
                        return (
                          <li key={label} className={i <= step ? "done" : ""}>
                            {label}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              )}
              <div className="item-list">
                {orders.map((o) => (
                  <article className="order-row" key={o.id}>
                    <button
                      className="order-open"
                      onClick={() => {
                        setDetail(o);
                        navigate("order-detail");
                      }}
                    >
                      <span className="list-preview">
                        <Bouquet design={o.orderItems[0].snapshot} small />
                      </span>
                      <span className="row-copy">
                        <small>
                          {new Date(o.created_at).toLocaleString("ko-KR")}
                        </small>
                        <h3>
                          {o.orderItems[0].snapshot.name}
                          {o.orderItems.length > 1
                            ? ` 외 ${o.orderItems.length - 1}건`
                            : ""}
                        </h3>
                        <span>
                          {statusNames[o.status] || o.status} · {won(o.total)}
                        </span>
                        <small>주문 상세 보기 →</small>
                      </span>
                    </button>
                    {["PAYMENT_COMPLETED","DEMO_CONFIRMED"].includes(o.status) && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api("orders/" + o.id + "/cancel", "POST");
                            setOrders(await api("orders"));
                            setCatalog(await api("catalog"));
                            setMessage("주문 취소가 완료되었어요.");
                          })
                        }
                      >
                        주문 취소
                      </button>
                    )}
                  </article>
                ))}
              </div>
              {!orders.length && (
                <p className="empty">아직 주문 내역이 없어요.</p>
              )}
            </>
          )}
          {page === "order-detail" && detail && (
            <>
              <button className="text-button" onClick={() => go("orders")}>
                ← 주문 내역으로
              </button>
              <p>
                주문 당시의 디자인과 배송 정보를 보여드리는 읽기 전용
                화면입니다.
              </p>
              <section className="order-info">
                <h2>{statusNames[detail.status] || detail.status}</h2>
                <p>주문 번호 {detail.id}</p>
                <p>{new Date(detail.created_at).toLocaleString("ko-KR")}</p>
                <p>
                  받는 분: {detail.address.name} · {detail.address.phone}
                </p>
                <p>배송지: {detail.address.address}</p>
                <p>요청사항: {detail.address.note || "없음"}</p>
              </section>
              <div className="item-list">
                {detail.orderItems.map((line, i) => (
                  <article className="list-row" key={line.id || i}>
                    <div className="list-preview">
                      <Bouquet design={line.snapshot} small />
                    </div>
                    <div className="row-copy">
                      <h3>{line.snapshot.name}</h3>
                      <p>{composition(line.snapshot)}</p>
                      <span>{line.quantity}개</span>
                    </div>
                    <strong>
                      {won((line.unitPrice || 0) * line.quantity)}
                    </strong>
                  </article>
                ))}
              </div>
              <div className="cart-summary">
                배송비 {won(detail.shipping)}
                <strong>결제 금액 {won(detail.total)}</strong>
              </div>
            </>
          )}
        </main>
      )}
      <footer>
        moff · 오래도록 피어있는 마음 <span>HANDMADE CHENILLE FLOWERS</span>
        <a href="/privacy.html">개인정보처리방침</a>
      </footer>
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      {modal && (
        <div className="overlay">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                setUser(
                  await api(
                    modal === "register" ? "register" : "login",
                    "POST",
                    Object.fromEntries(f),
                  ),
                );
                setModal("");
                setMessage("MOFF 꽃집에 오신 것을 환영해요.");
              });
            }}
          >
            <button
              type="button"
              className="close"
              onClick={() => setModal("")}
            >
              ×
            </button>
            <span className="eyebrow">WELCOME TO MOFF</span>
            <h2>
              {modal === "register" ? "처음 오셨나요?" : "다시 만나 반가워요"}
            </h2>
            <button type="button" className="google-login" disabled={!googleEnabled}
              onClick={()=>location.assign("/api/auth/google")}>
              {modal==="register"?"Google로 회원가입":"Google로 로그인"}{!googleEnabled && " · 준비 중"}
            </button>
            {modal === "register" && (
              <label>
                이름
                <input name="name" required maxLength={40} />
              </label>
            )}
            <label>
              이메일
              <input name="email" type="email" required />
            </label>
            <label>
              비밀번호
              <input
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={100}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "처리 중…" : modal === "register" ? "회원가입" : "로그인"}
            </button>
            <button
              type="button"
              onClick={() =>
                setModal(modal === "register" ? "login" : "register")
              }
            >
              {modal === "register"
                ? "이미 계정이 있어요"
                : "처음이에요 · 회원가입"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
