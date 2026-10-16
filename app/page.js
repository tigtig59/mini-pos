'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); // [{ id, qty }]
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ดึงรายการสินค้า
  async function fetchProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) setMessage({ type: 'error', text: error.message });
    else setProducts(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  // รวมข้อมูลตะกร้ากับข้อมูลสินค้า + คำนวณยอดรวม
  const lines = cart
    .map((c) => {
      const p = products.find((x) => x.id === c.id);
      return p ? { ...p, qty: c.qty, lineTotal: Number(p.price) * c.qty } : null;
    })
    .filter(Boolean);
  const grandTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalPieces = lines.reduce((sum, l) => sum + l.qty, 0);

  // กดสินค้า -> เพิ่มลงตะกร้า (ไม่เกินสต็อก)
  function addToCart(p) {
    setMessage({ type: '', text: '' });
    setCart((prev) => {
      const found = prev.find((c) => c.id === p.id);
      if (!found) return p.stock > 0 ? [...prev, { id: p.id, qty: 1 }] : prev;
      if (found.qty >= p.stock) return prev;
      return prev.map((c) => (c.id === p.id ? { ...c, qty: c.qty + 1 } : c));
    });
  }

  // เพิ่ม/ลดจำนวนในตะกร้า (ลดเหลือ 0 = เอาออก)
  function changeQty(id, delta) {
    const p = products.find((x) => x.id === id);
    setCart((prev) =>
      prev
        .map((c) =>
          c.id === id ? { ...c, qty: Math.min(c.qty + delta, p ? p.stock : c.qty) } : c
        )
        .filter((c) => c.qty > 0)
    );
  }

  function removeFromCart(id) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function clearCart() {
    setCart([]);
  }

  // ยืนยันการขายทั้งตะกร้า
  async function handleCheckout() {
    if (lines.length === 0) return;
    setMessage({ type: '', text: '' });
    setSubmitting(true);

    // 1) ดึง stock ล่าสุดของสินค้าทุกตัวในตะกร้า
    const ids = lines.map((l) => l.id);
    const { data: fresh, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .in('id', ids);

    if (fetchError) {
      setMessage({ type: 'error', text: fetchError.message });
      setSubmitting(false);
      return;
    }

    // 2) ตรวจสอบว่าสต็อกพอทุกรายการ
    for (const l of lines) {
      const f = fresh.find((x) => x.id === l.id);
      if (!f || f.stock < l.qty) {
        setMessage({
          type: 'error',
          text: `สินค้าไม่พอ! "${l.name}" คงเหลือ ${f ? f.stock : 0} ${l.unit}`,
        });
        setSubmitting(false);
        fetchProducts();
        return;
      }
    }

    // 3) ตัด stock ทีละรายการ (เช็ค stock เดิมซ้ำเพื่อกันขายชนกัน) เก็บรายการที่ตัดสำเร็จไว้เผื่อคืน
    const done = [];
    async function rollback() {
      for (const d of done) {
        await supabase.from('products').update({ stock: d.oldStock }).eq('id', d.id);
      }
    }

    for (const l of lines) {
      const f = fresh.find((x) => x.id === l.id);
      const { data: updated, error: updateError } = await supabase
        .from('products')
        .update({ stock: f.stock - l.qty })
        .eq('id', f.id)
        .eq('stock', f.stock)
        .select();

      if (updateError || !updated || updated.length === 0) {
        await rollback();
        setMessage({
          type: 'error',
          text: updateError
            ? updateError.message
            : `สต็อกของ "${l.name}" มีการเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง`,
        });
        setSubmitting(false);
        fetchProducts();
        return;
      }
      done.push({ id: f.id, oldStock: f.stock });
    }

    // 4) บันทึกลงตาราง sales (1 สินค้า = 1 แถว) ใช้เวลาขายเดียวกันทั้งบิล
    const soldAt = new Date().toISOString();
    const rows = lines.map((l) => ({
      product_id: l.id,
      product_name: l.name,
      quantity: l.qty,
      total_price: l.lineTotal,
      sold_at: soldAt,
    }));

    const { error: insertError } = await supabase.from('sales').insert(rows);

    if (insertError) {
      await rollback();
      setMessage({ type: 'error', text: `บันทึกการขายไม่สำเร็จ: ${insertError.message}` });
      setSubmitting(false);
      fetchProducts();
      return;
    }

    // 5) สำเร็จ
    setMessage({
      type: 'success',
      text: `ขายสำเร็จ ${lines.length} รายการ รวม ${grandTotal.toLocaleString('th-TH')} บาท`,
    });
    setCart([]);
    setSubmitting(false);
    fetchProducts();
  }

  // กรองสินค้าตามคำค้นหา (ชื่อหรือ SKU)
  const keyword = search.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      !keyword ||
      p.name.toLowerCase().includes(keyword) ||
      (p.sku || '').toLowerCase().includes(keyword)
  );

  return (
    <div>
      {/* ยอดรวมตัวใหญ่ไว้บนสุด ให้ทั้งผู้ขายและลูกค้าเห็นชัด */}
      <div className="total-banner">
        <div className="total-label">ยอดรวมที่ต้องชำระ</div>
        <div className="total-amount">{grandTotal.toLocaleString('th-TH')} บาท</div>
        <div className="total-meta">
          {lines.length} รายการ / {totalPieces} ชิ้น
        </div>
      </div>

      {message.text && <p className={`msg ${message.type}`}>{message.text}</p>}

      {loading ? (
        <p className="muted">กำลังโหลด...</p>
      ) : (
        <div className="pos-grid">
          {/* ซ้าย: เลือกสินค้า */}
          <section>
            <input
              className="search-box"
              placeholder="ค้นหาสินค้า (ชื่อ หรือ SKU)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="product-grid">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="product-tile"
                  disabled={p.stock <= 0}
                  onClick={() => addToCart(p)}
                >
                  <span className="tile-name">{p.name}</span>
                  <span className="tile-price">{Number(p.price).toLocaleString('th-TH')} บาท</span>
                  <span className="tile-stock">
                    {p.stock > 0 ? `เหลือ ${p.stock} ${p.unit}` : 'หมด'}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && <p className="muted">ไม่พบสินค้า</p>}
            </div>
          </section>

          {/* ขวา: ตะกร้า / ใบสรุป */}
          <aside className="card cart">
            <h2 className="cart-title">รายการที่ขาย</h2>

            {lines.length === 0 ? (
              <p className="muted">แตะสินค้าทางซ้ายเพื่อเพิ่มลงรายการ</p>
            ) : (
              <div className="cart-lines">
                {lines.map((l) => (
                  <div key={l.id} className="cart-line">
                    <div className="cart-info">
                      <div className="cart-name">{l.name}</div>
                      <div className="muted">
                        {Number(l.price).toLocaleString('th-TH')} x {l.qty} {l.unit}
                      </div>
                    </div>
                    <div className="qty-controls">
                      <button type="button" className="qty-btn" onClick={() => changeQty(l.id, -1)}>
                        −
                      </button>
                      <span className="qty-num">{l.qty}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        disabled={l.qty >= l.stock}
                        onClick={() => changeQty(l.id, 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="line-total">{l.lineTotal.toLocaleString('th-TH')}</div>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeFromCart(l.id)}
                      aria-label="ลบรายการ"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="checkout-btn"
              disabled={submitting || lines.length === 0}
              onClick={handleCheckout}
            >
              {submitting ? 'กำลังบันทึก...' : `ยืนยันการขาย ${grandTotal.toLocaleString('th-TH')} บาท`}
            </button>
            <button
              type="button"
              className="clear-btn"
              disabled={submitting || lines.length === 0}
              onClick={clearCart}
            >
              ล้างรายการ
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
