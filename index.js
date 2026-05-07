import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) => `$${Number(n).toFixed(2)}`
const fmtTime = (ts) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
const fmtDate = (ts) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const elapsed = (ts) => {
  if (!ts) return ''
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const STATUS_COLORS = {
  pending: '#f59e0b',
  in_process: '#ef4444',
  ready: '#22c55e',
}

// ─── Sound Alert ────────────────────────────────────────────────────────────

function playReadySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t)
      osc.stop(t + 0.35)
    })
  } catch (e) {}
}

function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'triangle'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch (e) {}
}

// ─── New Order Form ──────────────────────────────────────────────────────────

function NewOrderForm({ menuItems, onOrderCreated }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cart, setCart] = useState([])
  const [special, setSpecial] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const addItem = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const removeItem = (id) => {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  const updateQty = (id, qty) => {
    if (qty < 1) return removeItem(id)
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty } : c))
  }

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) return setError('Customer name required')
    if (!phone.trim()) return setError('Phone number required')
    if (!cart.length) return setError('Add at least one item')

    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name.trim(),
          phone_number: phone.trim(),
          order_items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
          special_requests: special.trim(),
          total,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccess(`Order #${data.order_number} placed for ${name}!`)
      setName(''); setPhone(''); setCart([]); setSpecial('')
      onOrderCreated(data)
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const categories = ['pizza', 'dessert', 'drink']
  const groupedMenu = categories.map(cat => ({
    cat,
    label: cat === 'pizza' ? '🍕 Pizzas' : cat === 'dessert' ? '🍫 Desserts' : '🥤 Drinks',
    items: menuItems.filter(m => m.category === cat && m.available),
  })).filter(g => g.items.length > 0)

  return (
    <div className="new-order-container">
      <div className="form-section">
        <h2 className="section-title">Customer Info</h2>
        <div className="field-row">
          <div className="field">
            <label>Customer Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="field">
            <label>Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" type="tel" />
          </div>
        </div>
        <div className="field">
          <label>Special Requests</label>
          <textarea value={special} onChange={e => setSpecial(e.target.value)} placeholder="Allergies, substitutions..." rows={2} />
        </div>
      </div>

      <div className="form-section">
        <h2 className="section-title">Menu</h2>
        {groupedMenu.map(group => (
          <div key={group.cat} className="menu-group">
            <div className="menu-group-label">{group.label}</div>
            <div className="menu-grid">
              {group.items.map(item => (
                <button key={item.id} className="menu-item-btn" onClick={() => addItem(item)}>
                  <span className="item-name">{item.name}</span>
                  <span className="item-price">{fmt(item.price)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="form-section cart-section">
          <h2 className="section-title">Order</h2>
          {cart.map(item => (
            <div key={item.id} className="cart-item">
              <span className="cart-name">{item.name}</span>
              <div className="cart-controls">
                <button className="qty-btn" onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                <span className="qty">{item.qty}</span>
                <button className="qty-btn" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                <span className="cart-subtotal">{fmt(item.price * item.qty)}</span>
                <button className="remove-btn" onClick={() => removeItem(item.id)}>✕</button>
              </div>
            </div>
          ))}
          <div className="cart-total">
            <span>Total</span>
            <strong>{fmt(total)}</strong>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Placing Order...' : '🍕 Place Order'}
      </button>
    </div>
  )
}

// ─── Order Card ──────────────────────────────────────────────────────────────

function OrderCard({ order, onUpdate }) {
  const [updating, setUpdating] = useState(false)
  const [timer, setTimer] = useState('')

  useEffect(() => {
    const ts = order.status === 'in_process' ? order.time_started : order.created_at
    const interval = setInterval(() => setTimer(elapsed(ts)), 10000)
    setTimer(elapsed(ts))
    return () => clearInterval(interval)
  }, [order])

  const update = async (status) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUpdate(data.archived ? { ...order, _archived: true } : data)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setUpdating(false)
  }

  const statusLabel = { pending: 'Waiting', in_process: 'In Process', ready: 'Ready!' }[order.status]
  const color = STATUS_COLORS[order.status]

  return (
    <div className="order-card" style={{ '--status-color': color }}>
      <div className="card-header">
        <div className="card-left">
          <span className="order-num">#{order.order_number}</span>
          {order.returning_customer && <span className="returning-badge">⭐ Returning</span>}
        </div>
        <div className="status-badge" style={{ background: color }}>
          {statusLabel}
        </div>
      </div>

      <div className="customer-info">
        <strong>{order.customer_name}</strong>
        <span>{order.phone_number}</span>
      </div>

      <div className="order-items-list">
        {order.order_items?.map((item, i) => (
          <div key={i} className="order-item-line">
            <span>{item.qty}× {item.name}</span>
            <span>{fmt(item.price * item.qty)}</span>
          </div>
        ))}
        {order.special_requests && (
          <div className="special-req">📝 {order.special_requests}</div>
        )}
      </div>

      <div className="card-footer">
        <div className="card-meta">
          <span className="total-display">{fmt(order.total)}</span>
          <span className="timer-display">
            {order.status === 'in_process' && order.time_started && `🕐 ${elapsed(order.time_started)}`}
            {order.status === 'pending' && `Waiting ${elapsed(order.created_at)}`}
            {order.status === 'ready' && order.total_time_minutes && `✅ ${order.total_time_minutes}min total`}
          </span>
        </div>

        <div className="card-actions">
          {order.status === 'pending' && (
            <button className="action-btn process-btn" onClick={() => update('in_process')} disabled={updating}>
              🔥 Start Order
            </button>
          )}
          {order.status === 'in_process' && (
            <button className="action-btn ready-btn" onClick={() => update('ready')} disabled={updating}>
              🔔 Mark Ready
            </button>
          )}
          {order.status === 'ready' && (
            <button className="action-btn complete-btn" onClick={() => update('completed')} disabled={updating}>
              ✅ Picked Up
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Live Orders Board ───────────────────────────────────────────────────────

function LiveOrders({ orders, onUpdate }) {
  const pending = orders.filter(o => o.status === 'pending')
  const inProcess = orders.filter(o => o.status === 'in_process')
  const ready = orders.filter(o => o.status === 'ready')

  const col = (title, list, color, icon) => (
    <div className="orders-col">
      <div className="col-header" style={{ borderColor: color }}>
        <span style={{ color }}>{icon} {title}</span>
        <span className="col-count" style={{ background: color }}>{list.length}</span>
      </div>
      <div className="col-cards">
        {list.length === 0 ? (
          <div className="empty-col">No orders</div>
        ) : (
          list.map(o => <OrderCard key={o.id} order={o} onUpdate={onUpdate} />)
        )}
      </div>
    </div>
  )

  return (
    <div className="live-orders-board">
      {col('Queue', pending, '#f59e0b', '⏳')}
      {col('In Process', inProcess, '#ef4444', '🔥')}
      {col('Ready', ready, '#22c55e', '🔔')}
    </div>
  )
}

// ─── History ─────────────────────────────────────────────────────────────────

function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/history').then(r => r.json()).then(d => {
      setHistory(d.data || [])
      setLoading(false)
    })
  }, [])

  const filtered = history.filter(o =>
    !search ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    String(o.order_number).includes(search) ||
    o.phone_number?.includes(search)
  )

  const totalRevenue = filtered.reduce((s, o) => s + Number(o.total), 0)
  const avgTime = filtered.filter(o => o.total_time_minutes).reduce((s, o, _, a) =>
    s + o.total_time_minutes / a.length, 0)

  return (
    <div>
      <div className="history-stats">
        <div className="stat-card"><div className="stat-val">{filtered.length}</div><div className="stat-label">Orders</div></div>
        <div className="stat-card"><div className="stat-val">{fmt(totalRevenue)}</div><div className="stat-label">Revenue</div></div>
        <div className="stat-card"><div className="stat-val">{avgTime ? Math.round(avgTime) + 'm' : '—'}</div><div className="stat-label">Avg Time</div></div>
        <div className="stat-card"><div className="stat-val">{filtered.filter(o => o.returning_customer).length}</div><div className="stat-label">Returning</div></div>
      </div>

      <input
        className="search-input"
        placeholder="Search by name, order #, or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="loading">Loading history...</div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Time</th>
                <th>Returning</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td className="order-num-cell">#{o.order_number}</td>
                  <td>{fmtDate(o.archived_at || o.created_at)}</td>
                  <td>
                    <div>{o.customer_name}</div>
                    <div className="sub-text">{o.phone_number}</div>
                  </td>
                  <td>
                    {o.order_items?.map((item, i) => (
                      <div key={i} className="history-item">{item.qty}× {item.name}</div>
                    ))}
                    {o.special_requests && <div className="sub-text">📝 {o.special_requests}</div>}
                  </td>
                  <td className="total-cell">{fmt(o.total)}</td>
                  <td>{o.total_time_minutes ? `${o.total_time_minutes}m` : '—'}</td>
                  <td>{o.returning_customer ? '⭐' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state">No orders found</div>}
        </div>
      )}
    </div>
  )
}

// ─── Menu Editor ─────────────────────────────────────────────────────────────

function MenuEditor({ menuItems, onMenuChange }) {
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'pizza' })
  const [saving, setSaving] = useState(false)

  const saveEdit = async (id) => {
    setSaving(true)
    const res = await fetch(`/api/menu/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editForm.name, price: parseFloat(editForm.price), available: editForm.available }),
    })
    const data = await res.json()
    onMenuChange(menuItems.map(m => m.id === id ? data : m))
    setEditingId(null)
    setSaving(false)
  }

  const toggleAvail = async (item) => {
    const res = await fetch(`/api/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !item.available }),
    })
    const data = await res.json()
    onMenuChange(menuItems.map(m => m.id === item.id ? data : m))
  }

  const deleteItem = async (id) => {
    if (!confirm('Delete this item?')) return
    await fetch(`/api/menu/${id}`, { method: 'DELETE' })
    onMenuChange(menuItems.filter(m => m.id !== id))
  }

  const addItem = async () => {
    if (!newItem.name || !newItem.price) return
    setSaving(true)
    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    })
    const data = await res.json()
    onMenuChange([...menuItems, data])
    setNewItem({ name: '', price: '', category: 'pizza' })
    setAdding(false)
    setSaving(false)
  }

  return (
    <div className="menu-editor">
      <div className="menu-editor-header">
        <h2 className="section-title">Menu Items</h2>
        <button className="add-item-btn" onClick={() => setAdding(!adding)}>+ Add Item</button>
      </div>

      {adding && (
        <div className="add-item-form">
          <input
            placeholder="Item name"
            value={newItem.name}
            onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
          />
          <input
            placeholder="Price"
            type="number"
            step="0.01"
            value={newItem.price}
            onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
          />
          <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
            <option value="pizza">Pizza</option>
            <option value="dessert">Dessert</option>
            <option value="drink">Drink</option>
          </select>
          <button className="save-btn" onClick={addItem} disabled={saving}>Save</button>
          <button className="cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}

      <div className="menu-items-list">
        {menuItems.map(item => (
          <div key={item.id} className={`menu-editor-item ${!item.available ? 'unavailable' : ''}`}>
            {editingId === item.id ? (
              <div className="edit-row">
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                />
                <input
                  type="number"
                  step="0.01"
                  value={editForm.price}
                  onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))}
                />
                <button className="save-btn" onClick={() => saveEdit(item.id)} disabled={saving}>Save</button>
                <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <div className="menu-item-row">
                <div className="menu-item-info">
                  <span className="menu-item-name">{item.name}</span>
                  <span className="menu-item-cat">{item.category}</span>
                </div>
                <span className="menu-item-price">{fmt(item.price)}</span>
                <div className="menu-item-actions">
                  <button
                    className={`avail-toggle ${item.available ? 'on' : 'off'}`}
                    onClick={() => toggleAvail(item)}
                  >{item.available ? 'Available' : 'Off Menu'}</button>
                  <button className="edit-btn" onClick={() => {
                    setEditingId(item.id)
                    setEditForm({ name: item.name, price: item.price, available: item.available })
                  }}>Edit</button>
                  <button className="delete-btn" onClick={() => deleteItem(item.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)
  const prevOrdersRef = useRef([])

  const loadOrders = useCallback(async () => {
    const res = await fetch('/api/orders?status=active')
    const data = await res.json()
    setOrders(data || [])
    return data || []
  }, [])

  const loadMenu = useCallback(async () => {
    const res = await fetch('/api/menu')
    const data = await res.json()
    setMenuItems(data || [])
  }, [])

  useEffect(() => {
    Promise.all([loadOrders(), loadMenu()]).then(() => setLoading(false))
  }, [])

  // Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => {
            playNewOrderSound()
            return [payload.new, ...prev]
          })
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => {
            const updated = payload.new
            const old = prev.find(o => o.id === updated.id)
            if (old?.status !== 'ready' && updated.status === 'ready') {
              playReadySound()
            }
            return prev.map(o => o.id === updated.id ? updated : o)
          })
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const handleOrderCreated = (order) => {
    playNewOrderSound()
    setOrders(prev => [order, ...prev])
    setTab('orders')
  }

  const handleOrderUpdate = (updated) => {
    if (updated._archived) {
      setOrders(prev => prev.filter(o => o.id !== updated.id))
    } else {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
      if (updated.status === 'ready') playReadySound()
    }
  }

  const tabs = [
    { id: 'new', label: '+ New Order' },
    { id: 'orders', label: `🍕 Live Orders${orders.length ? ` (${orders.length})` : ''}` },
    { id: 'history', label: '📋 History' },
    { id: 'menu', label: '📝 Menu Editor' },
  ]

  return (
    <>
      <Head>
        <title>Mamma Dio&apos;s — Order Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        <header className="app-header">
          <div className="header-inner">
            <div className="logo-area">
              <span className="logo-icon">🍕</span>
              <div>
                <h1 className="logo-text">Mamma Dio&apos;s</h1>
                <p className="logo-sub">Pizza Pop-Up Order System</p>
              </div>
            </div>
            <div className="header-stats">
              <div className="header-stat">
                <span className="hs-val">{orders.filter(o => o.status === 'pending').length}</span>
                <span className="hs-label">Waiting</span>
              </div>
              <div className="header-stat">
                <span className="hs-val">{orders.filter(o => o.status === 'in_process').length}</span>
                <span className="hs-label">Cooking</span>
              </div>
              <div className="header-stat ready-stat">
                <span className="hs-val">{orders.filter(o => o.status === 'ready').length}</span>
                <span className="hs-label">Ready</span>
              </div>
            </div>
          </div>
        </header>

        <nav className="tab-nav">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >{t.label}</button>
          ))}
        </nav>

        <main className="main-content">
          {loading ? (
            <div className="app-loading">
              <div className="pizza-spinner">🍕</div>
              <p>Loading Mamma Dio&apos;s...</p>
            </div>
          ) : (
            <>
              {tab === 'new' && (
                <NewOrderForm menuItems={menuItems} onOrderCreated={handleOrderCreated} />
              )}
              {tab === 'orders' && (
                <LiveOrders orders={orders} onUpdate={handleOrderUpdate} />
              )}
              {tab === 'history' && <History />}
              {tab === 'menu' && (
                <MenuEditor menuItems={menuItems} onMenuChange={setMenuItems} />
              )}
            </>
          )}
        </main>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --red: #c0392b;
          --red-dark: #96281b;
          --red-light: #e74c3c;
          --cream: #fdf6e3;
          --cream-dark: #f5e6c8;
          --brown: #8b4513;
          --brown-light: #a0522d;
          --green: #22c55e;
          --amber: #f59e0b;
          --text: #2c1810;
          --text-muted: #7a6154;
          --border: #e8d5b0;
          --card-bg: #fffdf7;
          --shadow: 0 2px 12px rgba(44, 24, 16, 0.08);
          --shadow-lg: 0 8px 32px rgba(44, 24, 16, 0.12);
        }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--cream);
          color: var(--text);
          min-height: 100vh;
        }

        /* Header */
        .app-header {
          background: var(--red);
          color: white;
          padding: 0;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 4px 20px rgba(192, 57, 43, 0.3);
        }
        .header-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .logo-area {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-icon { font-size: 2rem; }
        .logo-text {
          font-family: 'Playfair Display', serif;
          font-size: 1.6rem;
          font-weight: 900;
          letter-spacing: -0.5px;
          line-height: 1;
        }
        .logo-sub {
          font-size: 0.7rem;
          opacity: 0.75;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 2px;
        }
        .header-stats { display: flex; gap: 20px; }
        .header-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(255,255,255,0.15);
          border-radius: 10px;
          padding: 8px 16px;
          min-width: 60px;
        }
        .hs-val {
          font-family: 'Playfair Display', serif;
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
        }
        .hs-label { font-size: 0.65rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .ready-stat { background: rgba(34, 197, 94, 0.3); }

        /* Tabs */
        .tab-nav {
          background: var(--red-dark);
          display: flex;
          gap: 0;
          overflow-x: auto;
          border-bottom: 3px solid var(--cream-dark);
        }
        .tab-btn {
          padding: 12px 22px;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.7);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          border-bottom: 3px solid transparent;
          margin-bottom: -3px;
          transition: all 0.15s;
        }
        .tab-btn:hover { color: white; background: rgba(255,255,255,0.08); }
        .tab-btn.active { color: white; border-bottom-color: var(--cream); font-weight: 600; background: rgba(255,255,255,0.1); }

        /* Main */
        .main-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
        }

        .app-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          gap: 16px;
          color: var(--text-muted);
        }
        .pizza-spinner {
          font-size: 3rem;
          animation: spin 2s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* New Order Form */
        .new-order-container {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .form-section {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: var(--shadow);
        }
        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.2rem;
          color: var(--red);
          margin-bottom: 16px;
          font-weight: 700;
        }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .field input, .field textarea, input, textarea, select {
          border: 1.5px solid var(--border);
          border-radius: 8px;
          padding: 10px 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          background: white;
          color: var(--text);
          transition: border-color 0.15s;
          width: 100%;
        }
        .field input:focus, .field textarea:focus, input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: var(--red);
        }

        /* Menu grid */
        .menu-group { margin-bottom: 16px; }
        .menu-group-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 8px;
        }
        .menu-item-btn {
          border: 2px solid var(--border);
          background: white;
          border-radius: 10px;
          padding: 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .menu-item-btn:hover {
          border-color: var(--red);
          background: #fff5f5;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(192, 57, 43, 0.1);
        }
        .item-name { font-size: 0.85rem; font-weight: 600; color: var(--text); }
        .item-price { font-size: 0.85rem; color: var(--red); font-weight: 700; }

        /* Cart */
        .cart-section { background: #fff9f0; }
        .cart-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
          gap: 12px;
        }
        .cart-name { font-size: 0.9rem; font-weight: 500; flex: 1; }
        .cart-controls { display: flex; align-items: center; gap: 8px; }
        .qty-btn {
          width: 28px; height: 28px;
          border: 1.5px solid var(--border);
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          font-family: 'DM Sans', sans-serif;
        }
        .qty-btn:hover { background: var(--cream); }
        .qty { font-weight: 700; min-width: 20px; text-align: center; }
        .cart-subtotal { font-weight: 600; color: var(--red); min-width: 48px; text-align: right; }
        .remove-btn {
          border: none;
          background: none;
          color: #ccc;
          cursor: pointer;
          font-size: 0.85rem;
          padding: 4px;
        }
        .remove-btn:hover { color: var(--red); }
        .cart-total {
          display: flex;
          justify-content: space-between;
          padding-top: 12px;
          font-size: 1.1rem;
          font-weight: 600;
        }
        .cart-total strong { color: var(--red); font-size: 1.2rem; }

        /* Alerts */
        .alert {
          padding: 14px 18px;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .alert-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }

        /* Submit */
        .submit-btn {
          background: var(--red);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 32px;
          font-family: 'Playfair Display', serif;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 4px 16px rgba(192, 57, 43, 0.3);
        }
        .submit-btn:hover { background: var(--red-dark); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(192, 57, 43, 0.4); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* Live Orders Board */
        .live-orders-board {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          align-items: start;
        }
        .orders-col { display: flex; flex-direction: column; gap: 12px; }
        .col-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-radius: 10px;
          background: white;
          border: 2px solid;
          font-weight: 700;
          font-size: 0.95rem;
        }
        .col-count {
          color: white;
          border-radius: 20px;
          padding: 2px 10px;
          font-size: 0.8rem;
          font-weight: 700;
        }
        .col-cards { display: flex; flex-direction: column; gap: 10px; }
        .empty-col { text-align: center; color: var(--text-muted); padding: 24px; font-size: 0.9rem; }

        /* Order Card */
        .order-card {
          background: var(--card-bg);
          border: 1.5px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: var(--shadow);
          border-top: 3px solid var(--status-color);
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px 8px;
        }
        .card-left { display: flex; align-items: center; gap: 8px; }
        .order-num { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; color: var(--text); }
        .returning-badge {
          background: #fef3c7;
          color: #92400e;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .status-badge {
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .customer-info {
          padding: 0 14px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          border-bottom: 1px solid var(--border);
        }
        .customer-info strong { font-size: 0.9rem; }
        .customer-info span { font-size: 0.75rem; color: var(--text-muted); }
        .order-items-list {
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
        }
        .order-item-line {
          display: flex;
          justify-content: space-between;
          font-size: 0.82rem;
          padding: 2px 0;
        }
        .special-req {
          font-size: 0.78rem;
          color: var(--brown);
          background: #fff8e6;
          border-radius: 6px;
          padding: 5px 8px;
          margin-top: 6px;
        }
        .card-footer { padding: 10px 14px; }
        .card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .total-display { font-weight: 700; color: var(--red); font-size: 0.95rem; }
        .timer-display { font-size: 0.75rem; color: var(--text-muted); }
        .card-actions { display: flex; gap: 8px; }
        .action-btn {
          flex: 1;
          padding: 9px;
          border: none;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .process-btn { background: #fef3c7; color: #92400e; }
        .process-btn:hover { background: #fde68a; }
        .ready-btn { background: #fee2e2; color: #991b1b; }
        .ready-btn:hover { background: #fca5a5; }
        .complete-btn { background: #dcfce7; color: #166534; }
        .complete-btn:hover { background: #86efac; }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* History */
        .history-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          box-shadow: var(--shadow);
        }
        .stat-val { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-weight: 700; color: var(--red); }
        .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

        .search-input {
          width: 100%;
          margin-bottom: 16px;
          padding: 12px 16px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          background: white;
        }
        .search-input:focus { outline: none; border-color: var(--red); }

        .history-table-wrap {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: var(--shadow);
          overflow-x: auto;
        }
        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .history-table th {
          background: var(--cream-dark);
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .history-table td { padding: 12px 16px; border-top: 1px solid var(--border); vertical-align: top; }
        .history-table tr:hover td { background: #fffbf5; }
        .order-num-cell { font-family: 'Playfair Display', serif; font-weight: 700; color: var(--red); }
        .total-cell { font-weight: 700; color: var(--red); }
        .sub-text { color: var(--text-muted); font-size: 0.78rem; margin-top: 2px; }
        .history-item { font-size: 0.82rem; }
        .empty-state { text-align: center; padding: 40px; color: var(--text-muted); }
        .loading { text-align: center; padding: 40px; color: var(--text-muted); }

        /* Menu Editor */
        .menu-editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .add-item-btn {
          background: var(--red);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 18px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .add-item-btn:hover { background: var(--red-dark); }
        .add-item-form {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
          background: #fff9f0;
          padding: 16px;
          border-radius: 10px;
          border: 1px dashed var(--border);
          flex-wrap: wrap;
        }
        .add-item-form input, .add-item-form select { flex: 1; min-width: 120px; }
        .save-btn {
          background: var(--green);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .save-btn:disabled { opacity: 0.6; }
        .cancel-btn {
          background: #e5e7eb;
          color: #374151;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .menu-items-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .menu-editor-item {
          background: white;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          padding: 14px 16px;
          transition: opacity 0.2s;
        }
        .menu-editor-item.unavailable { opacity: 0.55; }
        .menu-item-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .menu-item-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .menu-item-name { font-weight: 600; font-size: 0.92rem; }
        .menu-item-cat { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; }
        .menu-item-price { font-weight: 700; color: var(--red); font-size: 0.95rem; min-width: 52px; text-align: right; }
        .menu-item-actions { display: flex; gap: 8px; }
        .avail-toggle {
          border: none;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        }
        .avail-toggle.on { background: #dcfce7; color: #166534; }
        .avail-toggle.off { background: #f3f4f6; color: #6b7280; }
        .edit-btn {
          background: #eff6ff;
          color: #1d4ed8;
          border: none;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        }
        .delete-btn {
          background: #fee2e2;
          color: #991b1b;
          border: none;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        }
        .edit-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .edit-row input { max-width: 220px; }

        /* Responsive */
        @media (max-width: 900px) {
          .live-orders-board { grid-template-columns: 1fr; }
          .history-stats { grid-template-columns: repeat(2, 1fr); }
          .field-row { grid-template-columns: 1fr; }
          .header-stats { display: none; }
        }
        @media (max-width: 600px) {
          .main-content { padding: 12px; }
          .history-stats { grid-template-columns: repeat(2, 1fr); }
          .menu-grid { grid-template-columns: repeat(2, 1fr); }
          .menu-item-row { flex-wrap: wrap; }
          .menu-item-actions { flex-wrap: wrap; }
        }
      `}</style>
    </>
  )
}
