'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ดึงประวัติการขายทั้งหมด เรียงจากล่าสุดไปเก่าสุด
  useEffect(() => {
    async function fetchSales() {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('sold_at', { ascending: false });

      if (error) setError(error.message);
      else setSales(data);
      setLoading(false);
    }
    fetchSales();
  }, []);

  // ยอดขายรวมทั้งหมด (รวม total_price ทุกรายการ)
  const grandTotal = sales.reduce((sum, s) => sum + Number(s.total_price), 0);

  // จัดรูปแบบวันเวลาเป็นแบบไทย
  function formatDate(iso) {
    return new Date(iso).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {error && (
        <p className="error" style={{ marginBottom: 12 }}>
          เกิดข้อผิดพลาด: {error}
        </p>
      )}

      {/* ยอดขายรวมทั้งหมด */}
      <div className="card">
        <p className="muted">ยอดขายรวมทั้งหมด</p>
        <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>
          {grandTotal.toLocaleString('th-TH')} บาท
        </p>
        <p className="muted" style={{ fontSize: '0.875rem' }}>
          จาก {sales.length} รายการ
        </p>
      </div>

      {/* ตารางประวัติการขาย */}
      {loading ? (
        <p className="muted">กำลังโหลด...</p>
      ) : sales.length === 0 ? (
        <p className="muted">ยังไม่มีรายการขาย</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>วันเวลาที่ขาย</th>
              <th>ชื่อสินค้า</th>
              <th>จำนวน</th>
              <th>ยอดรวม (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{formatDate(s.sold_at)}</td>
                <td>{s.product_name}</td>
                <td>{s.quantity}</td>
                <td>{Number(s.total_price).toLocaleString('th-TH')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
