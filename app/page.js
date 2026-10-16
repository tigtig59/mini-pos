'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// ค่าเริ่มต้นของฟอร์ม (ใช้ทั้งฟอร์มเพิ่มและแถวที่กำลังแก้ไข)
const emptyForm = { sku: '', name: '', price: '', stock: '', unit: '' };

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState(emptyForm); // ฟอร์มเพิ่มสินค้า
  const [editingId, setEditingId] = useState(null); // id ของแถวที่กำลังแก้ไข
  const [editForm, setEditForm] = useState(emptyForm); // ข้อมูลของแถวที่กำลังแก้ไข

  // ดึงสินค้าทั้งหมดจาก Supabase
  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else {
      setError('');
      setProducts(data);
    }
    setLoading(false);
  }

  // โหลดข้อมูลครั้งแรกเมื่อเปิดหน้า
  useEffect(() => {
    fetchProducts();
  }, []);

  // เพิ่มสินค้าใหม่
  async function handleAdd(e) {
    e.preventDefault();
    const { error } = await supabase.from('products').insert({
      sku: form.sku.trim(),
      name: form.name.trim(),
      price: Number(form.price),
      stock: parseInt(form.stock, 10),
      unit: form.unit.trim(),
    });

    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    fetchProducts();
  }

  // เริ่มแก้ไข: คัดลอกข้อมูลแถวนั้นลงใน editForm
  function startEdit(p) {
    setEditingId(p.id);
    setEditForm({
      sku: p.sku,
      name: p.name,
      price: p.price,
      stock: p.stock,
      unit: p.unit,
    });
  }

  // บันทึกการแก้ไข
  async function handleSave(id) {
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku.trim(),
        name: editForm.name.trim(),
        price: Number(editForm.price),
        stock: parseInt(editForm.stock, 10),
        unit: editForm.unit.trim(),
      })
      .eq('id', id);

    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    fetchProducts();
  }

  // ลบสินค้า (ถามยืนยันก่อน)
  async function handleDelete(id, name) {
    if (!window.confirm(`ต้องการลบ "${name}" ใช่หรือไม่?`)) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    fetchProducts();
  }

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {error && <p className="error" style={{ marginBottom: 12 }}>เกิดข้อผิดพลาด: {error}</p>}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <form className="card" onSubmit={handleAdd}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <input
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            required
          />
          <input
            placeholder="ชื่อสินค้า"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="ราคา"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <input
            type="number"
            min="0"
            placeholder="คงเหลือ"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            required
          />
          <input
            placeholder="หน่วย (เช่น ชิ้น)"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            required
          />
        </div>
        <button type="submit">+ เพิ่มสินค้า</button>
      </form>

      {/* ตารางสินค้า */}
      {loading ? (
        <p className="muted">กำลังโหลด...</p>
      ) : products.length === 0 ? (
        <p className="muted">ยังไม่มีสินค้า</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) =>
              editingId === p.id ? (
                // แถวที่อยู่ในโหมดแก้ไข (inline)
                <tr key={p.id}>
                  <td>
                    <input
                      value={editForm.sku}
                      onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={editForm.stock}
                      onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleSave(p.id)} style={{ marginRight: 6 }}>
                      บันทึก
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ background: 'var(--muted)' }}
                    >
                      ยกเลิก
                    </button>
                  </td>
                </tr>
              ) : (
                // แถวแสดงผลปกติ
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{Number(p.price).toLocaleString('th-TH')}</td>
                  <td>{p.stock}</td>
                  <td>{p.unit}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(p)} style={{ marginRight: 6 }}>
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      style={{ background: 'var(--danger)' }}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
