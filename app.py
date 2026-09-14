
import io, sqlite3
from datetime import datetime
from pathlib import Path
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

BASE = Path(__file__).parent
DB = BASE / "stockmaison.db"
STATIC = BASE / "static"
app = FastAPI(title="StockMaison V2")

def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

with conn() as c:
    c.executescript("""
    CREATE TABLE IF NOT EXISTS products(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT DEFAULT 'Autre',
      quantity REAL DEFAULT 0,
      minimum REAL DEFAULT 1,
      target_quantity REAL DEFAULT 3,
      unit TEXT DEFAULT 'unité(s)',
      image_url TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS movements(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      delta REAL,
      reason TEXT,
      created_at TEXT
    );
    """)

class Product(BaseModel):
    barcode: str | None = None
    name: str
    brand: str | None = None
    category: str = "Autre"
    quantity: float = 1
    minimum: float = 1
    target_quantity: float = 3
    unit: str = "unité(s)"
    image_url: str | None = None

class Qty(BaseModel):
    amount: float = 1

def serialize(r):
    p = dict(r)
    p["low_stock"] = p["quantity"] <= p["minimum"]
    p["to_buy"] = max(0, p["target_quantity"] - p["quantity"]) if p["low_stock"] else 0
    return p

@app.get("/api/products")
def products():
    with conn() as c:
        return [serialize(r) for r in c.execute("SELECT * FROM products ORDER BY name COLLATE NOCASE")]

@app.post("/api/products")
def add_product(p: Product):
    now = datetime.now().isoformat(timespec="seconds")
    barcode = (p.barcode or "").strip() or None
    with conn() as c:
        existing = c.execute("SELECT * FROM products WHERE barcode=?", (barcode,)).fetchone() if barcode else None
        if existing:
            c.execute("""UPDATE products SET quantity=?,name=?,brand=?,category=?,minimum=?,
                       target_quantity=?,unit=?,image_url=?,updated_at=? WHERE id=?""",
                      (existing["quantity"]+p.quantity,p.name,p.brand,p.category,p.minimum,
                       p.target_quantity,p.unit,p.image_url,now,existing["id"]))
            pid = existing["id"]
        else:
            cur = c.execute("""INSERT INTO products(barcode,name,brand,category,quantity,minimum,
                             target_quantity,unit,image_url,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)""",
                            (barcode,p.name,p.brand,p.category,p.quantity,p.minimum,
                             p.target_quantity,p.unit,p.image_url,now))
            pid = cur.lastrowid
        c.execute("INSERT INTO movements(product_id,delta,reason,created_at) VALUES(?,?,?,?)",
                  (pid,p.quantity,"courses",now))
        c.commit()
        return serialize(c.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone())

@app.post("/api/products/{pid}/consume")
def consume(pid:int, q:Qty):
    now=datetime.now().isoformat(timespec="seconds")
    with conn() as c:
        r=c.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
        if not r: raise HTTPException(404,"Produit introuvable")
        new=max(0,r["quantity"]-q.amount)
        c.execute("UPDATE products SET quantity=?,updated_at=? WHERE id=?", (new,now,pid))
        c.execute("INSERT INTO movements(product_id,delta,reason,created_at) VALUES(?,?,?,?)",
                  (pid,new-r["quantity"],"consommation",now))
        c.commit()
    return {"ok":True}

@app.post("/api/products/{pid}/add")
def add(pid:int, q:Qty):
    now=datetime.now().isoformat(timespec="seconds")
    with conn() as c:
        r=c.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
        if not r: raise HTTPException(404,"Produit introuvable")
        c.execute("UPDATE products SET quantity=?,updated_at=? WHERE id=?", (r["quantity"]+q.amount,now,pid))
        c.execute("INSERT INTO movements(product_id,delta,reason,created_at) VALUES(?,?,?,?)",
                  (pid,q.amount,"ajout",now))
        c.commit()
    return {"ok":True}

@app.delete("/api/products/{pid}")
def delete(pid:int):
    with conn() as c:
        c.execute("DELETE FROM products WHERE id=?", (pid,))
        c.commit()
    return {"ok":True}

@app.get("/api/barcode/{barcode}")
async def barcode(barcode:str):
    with conn() as c:
        r=c.execute("SELECT * FROM products WHERE barcode=?", (barcode,)).fetchone()
        if r: return {"source":"local","product":serialize(r)}
    try:
        async with httpx.AsyncClient(timeout=8, headers={"User-Agent":"StockMaisonV2"}) as client:
            res = await client.get(f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json")
            data = res.json()
    except Exception:
        raise HTTPException(502,"Open Food Facts indisponible")
    if data.get("status") != 1:
        return {"source":"unknown","product":None}
    p=data.get("product",{})
    return {"source":"openfoodfacts","product":{
        "barcode":barcode,
        "name":p.get("product_name_fr") or p.get("product_name") or "Produit sans nom",
        "brand":p.get("brands") or "",
        "category":"Alimentation",
        "unit":"unité(s)",
        "image_url":p.get("image_front_small_url") or p.get("image_url")
    }}

@app.get("/api/shopping-list.pdf")
def pdf():
    with conn() as c:
        rows=c.execute("SELECT * FROM products WHERE quantity<=minimum ORDER BY category,name").fetchall()
    buf=io.BytesIO()
    pdf=canvas.Canvas(buf,pagesize=A4)
    w,h=A4
    pdf.setFont("Helvetica-Bold",20)
    pdf.drawString(45,h-55,"Liste de courses")
    y=h-90
    for r in rows:
        p=serialize(r)
        qty=p["to_buy"]
        pdf.setFont("Helvetica",11)
        pdf.drawString(55,y,f"- {p['name']} : acheter {qty:g} {p['unit']}")
        y-=20
        if y<60:
            pdf.showPage()
            y=h-60
    pdf.save()
    buf.seek(0)
    return StreamingResponse(buf,media_type="application/pdf",
        headers={"Content-Disposition":'attachment; filename="liste-de-courses.pdf"'})


@app.get("/api/scanner-status")
def scanner_status():
    f = STATIC / "html5-qrcode.min.js"
    return {"installed": f.exists(), "size": f.stat().st_size if f.exists() else 0}

app.mount("/static", StaticFiles(directory=STATIC), name="static")

@app.get("/")
def home():
    return FileResponse(STATIC/"index.html")
