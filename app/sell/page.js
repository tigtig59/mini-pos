'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ดึงรายการสินค้าสำหรับ dropdown
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

  // สินค้าที่เลือก และยอดรวมที่คำนวณอัตโนมัติ
  const selected = products.find((p) => p.id === productId);
  const qty = parseInt(quantity, 10) || 0;
  const total = selected ? Number(selected.price) * qty : 0;

  async function handleSell(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!selected || qty <= 0) {
      setMessage({ type: 'error', text: 'กรุณาเลือกสินค้าและระบุจำนวนที่ถูกต้อง' });
      return;
    }

    setSubmitting(true);

    // 1) ดึง stock ล่าสุดจากฐานข้อมูลอีกครั้ง (กันข้อมูลในหน้าจอเก่า)
    const { data: fresh, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', selected.id)
      .single();

    if (fetchError) {
      setMessage({ type: 'error', text: fetchError.message });
      setSubmitting(false);
      return;
    }

    // 2) ตรวจสอบว่าสินค้าคงเหลือเพียงพอหรือไม่
    if (fresh.stock < qty) {
      setMessage({
        type: 'error',
        text: `สินค้าไม่พอ! "${fresh.name}" คงเหลือ ${fresh.stock} ${fresh.unit}`,
      });
      setSubmitting(false);
      fetchProducts();
      return;
    }

    // 3) ตัด stock (เช็ค stock เดิมซ้ำใน .eq เพื่อกันมีคนขายตัดหน้าพร้อมกัน)
    const newStock = fresh.stock - qty;
    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', fresh.id)
      .eq('stock', fresh.stock)
      .select();

    if (updateError || !updated || updated.length === 0) {
      setMessage({
        type: 'error',
        text: updateError ? updateError.message : 'สต็อกมีการเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง',
      });
      setSubmitting(false);
      fetchProducts();
      return;
    }

    // 4) บันทึกรายการขายลงตาราง sales
    const { error: insertError } = await supabase.from('sales').insert({
      product_id: fresh.id,
      product_name: fresh.name,
      quantity: qty,
      total_price: Number(fresh.price) * qty,
      sold_at: new Date().toISOString(),
    });

    if (insertError) {
      // บันทึกไม่สำเร็จ -> คืน stock กลับ
      await supabase.from('products').update({ stock: fresh.stock }).eq('id', fresh.id);
      setMessage({ type: 'error', text: `บันทึกการขายไม่สำเร็จ: ${insertError.message}` });
      setSubmitting(false);
      fetchProducts();
      return;
    }

    // 5) สำเร็จ: แสดงข้อความ รีเซ็ตฟอร์ม และโหลดสต็อกใหม่
    setMessage({
      type: 'success',
      text: `ขายสำเร็จ: ${fresh.name} x ${qty} ${fresh.unit} รวม ${(
        Number(fresh.price) * qty
      ).toLocaleString('th-TH')} บาท`,
    });
    setProductId('');
    setQuantity('');
    setSubmitting(false);
    fetchProducts();
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {message.text && (
        <p className={message.type} style={{ marginBottom: 12 }}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="muted">กำลังโหลด...</p>
      ) : (
        <form className="card" onSubmit={handleSell}>
          {/* เลือกสินค้า */}
          <label className="muted">สินค้า</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            style={{ marginBottom: 12 }}
          >
            <option value="">-- เลือกสินค้า --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {Number(p.price).toLocaleString('th-TH')} บาท (คงเหลือ {p.stock} {p.unit})
              </option>
            ))}
          </select>

          {/* จำนวนที่จะขาย */}
          <label className="muted">จำนวน</label>
          <input
            type="number"
            min="1"
            placeholder="จำนวนที่จะขาย"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            style={{ marginBottom: 12 }}
          />

          {/* ยอดรวมอัตโนมัติ */}
          <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>
            ยอดรวม: {total.toLocaleString('th-TH')} บาท
          </p>

          <button type="submit" disabled={submitting || !selected || qty <= 0}>
            {submitting ? 'กำลังบันทึก...' : 'ขาย'}
          </button>
        </form>
      )}
    </div>
  );
}
