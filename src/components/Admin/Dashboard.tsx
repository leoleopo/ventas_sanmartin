import { useState, useEffect, useRef } from 'react'
import { orderService, Order } from '../../services/orderService'
import { productService, Product, configService } from '../../services/productService'
import { CheckCircle, Clock, Package, Plus, Trash2, X, ShoppingBag, AlertCircle, Upload, ChevronLeft, ChevronRight, Image as ImageIcon, Phone, Settings } from 'lucide-react'

interface ProductForm {
  nombre: string
  descripcion: string
  precio: string
  imagenes: string[]
  stock: string
  precios_bulk: { cantidad: number, precio_total: number }[]
}

const emptyForm: ProductForm = {
  nombre: '',
  descripcion: '',
  precio: '',
  imagenes: [],
  stock: '0',
  precios_bulk: [
    { cantidad: 6, precio_total: 0 },
    { cantidad: 12, precio_total: 0 }
  ]
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [whatsapp, setWhatsapp] = useState('')
  const [datosBancarios, setDatosBancarios] = useState('')
  const [notasPlaceholder, setNotasPlaceholder] = useState('')
  const [tab, setTab] = useState<'orders' | 'products' | 'config'>('orders')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
  const [showManualOrderForm, setShowManualOrderForm] = useState(false)
  const [manualOrder, setManualOrder] = useState({
    cliente_nombre: '', apellido: '', telefono: '', producto_id: '', cantidad: 1, notas: ''
  })
  const [filterProductId, setFilterProductId] = useState<string>('all')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refreshData()
  }, [])

  const refreshData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [o, p, c] = await Promise.all([
        orderService.getAll(), 
        productService.getAll(),
        configService.getConfig()
      ])
      setOrders(o)
      setProducts(p)
      setWhatsapp(c.whatsapp_numero || '')
      setDatosBancarios(c.datos_bancarios || '')
      setNotasPlaceholder(c.notas_placeholder || '')
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const toggleStatus = async (order: Order) => {
    if (updatingOrders.has(order.id)) return // Already processing

    const newStatus = order.estado === 'pendiente' ? 'entregado' : 'pendiente'
    
    // Track updating state
    setUpdatingOrders(prev => new Set(prev).add(order.id))
    
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, estado: newStatus } : o))
    
    try {
      await orderService.updateStatus(order.id, newStatus)
      // Success: No need to refresh everything, local state is already correct
    } catch (err: any) {
      setError(err.message || 'Error al actualizar estado')
      // Rollback on error
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, estado: order.estado } : o))
    } finally {
      setUpdatingOrders(prev => {
        const next = new Set(prev)
        next.delete(order.id)
        return next
      })
    }
  }

  const handleUpdateAdminNotes = async (id: string, notes: string) => {
    try {
      await orderService.updateAdminNotes(id, notes)
      await refreshData(false)
    } catch (err: any) {
      setError(err.message || 'Error al actualizar notas')
    }
  }

  const handleDeleteAllOrders = async () => {
    if (!confirm('🚨 ¿Estás SEGURO de que querés borrar TODOS los pedidos? Esta acción no se puede deshacer.')) return
    
    setLoading(true)
    setError(null)
    try {
      await orderService.deleteAllOrders()
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Error al eliminar pedidos')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    setUploading(true)
    setError(null)
    const newUrls: string[] = []
    
    try {
      const files = Array.from(e.target.files)
      for (const file of files) {
        const url = await productService.uploadImage(file)
        newUrls.push(url)
      }
      setForm(prev => ({ ...prev, imagenes: [...prev.imagenes, ...newUrls] }))
    } catch (err: any) {
      setError('Error al subir imágenes: ' + err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, i) => i !== index)
    }))
  }

  const handleSubmitProduct = async () => {
    if (!form.nombre.trim() || !form.precio.trim()) {
      setError('Nombre y precio son obligatorios')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const productData = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        precio: parseFloat(form.precio),
        imagenes: form.imagenes.length > 0 ? form.imagenes : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600'],
        stock: parseInt(form.stock) || 0,
        activo: true,
        cantidades: form.precios_bulk.map(pb => pb.cantidad).filter(c => c > 0),
        precios_bulk: form.precios_bulk.filter(pb => pb.cantidad > 0)
      }

      if (editingId) {
        await productService.updateProduct(editingId, productData)
      } else {
        await productService.addProduct(productData)
      }

      closeModal()
      await refreshData()
    } catch (err: any) {
      setError(err.message || `Error al ${editingId ? 'editar' : 'agregar'} producto`)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await configService.updateConfig(whatsapp, datosBancarios, notasPlaceholder)
      alert('Configuración guardada')
    } catch (err: any) {
      setError(err.message || 'Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitManualOrder = async () => {
    const p = products.find(prod => prod.id === manualOrder.producto_id)
    if (!p) {
      setError('Seleccioná un producto')
      return
    }
    if (!manualOrder.cliente_nombre.trim() || !manualOrder.apellido.trim()) {
      setError('Nombre y apellido son obligatorios')
      return
    }
    if (manualOrder.cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0')
      return
    }

    setSaving(true)
    setError(null)
    const total = p.precio * manualOrder.cantidad
    
    try {
      await orderService.createOrder({
        cliente_nombre: manualOrder.cliente_nombre.trim(),
        apellido: manualOrder.apellido.trim(),
        telefono: manualOrder.telefono.trim(),
        notas: manualOrder.notas.trim(),
        admin_notas: 'Pedido manual agregado desde Admin',
        total,
        comprobante_url: 'Pedido Manual', // Placeholder for DB if missing
        items: [{
          producto_id: p.id,
          nombre: p.nombre,
          cantidad: manualOrder.cantidad,
          precio: p.precio
        }]
      } as any) // cast to any to handle optional fields correctly
      
      setShowManualOrderForm(false)
      setManualOrder({ cliente_nombre: '', apellido: '', telefono: '', producto_id: '', cantidad: 1, notas: '' })
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Error al crear pedido manual')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (p: Product) => {
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: p.precio.toString(),
      imagenes: p.imagenes || [],
      stock: p.stock.toString(),
      precios_bulk: p.precios_bulk?.length ? p.precios_bulk : (p.cantidades || [6, 12, 18, 24]).map(c => ({ cantidad: c, precio_total: c * p.precio }))
    })
    setEditingId(p.id)
    setError(null)
    setShowForm(true)
  }

  const closeModal = () => {
    setForm(emptyForm)
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de que querés eliminar este producto?')) return

    setDeleting(id)
    setError(null)
    try {
      await productService.deleteProduct(id)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Error al eliminar producto')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="loading-spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando panel...</p>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {error && (
        <div className="error-banner">
          <AlertCircle size={20} color="#DC2626" />
          <span style={{ color: '#991B1B', flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none' }}><X size={16} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        <button onClick={() => setTab('orders')} className={`admin-tab ${tab === 'orders' ? 'active' : ''}`}>
          <ShoppingBag size={18} /> Pedidos
        </button>
        <button onClick={() => setTab('products')} className={`admin-tab ${tab === 'products' ? 'active' : ''}`}>
          <Package size={18} /> Productos
        </button>
        <button onClick={() => setTab('config')} className={`admin-tab ${tab === 'config' ? 'active' : ''}`}>
          <Settings size={18} /> Config
        </button>
      </div>

      {tab === 'orders' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem' }}>Lista de Pedidos</h2>
              <select 
                value={filterProductId} 
                onChange={(e) => setFilterProductId(e.target.value)}
                className="glass"
                style={{ 
                  padding: '0.4rem 2rem 0.4rem 0.8rem', 
                  fontSize: '0.85rem', 
                  borderRadius: '99px', 
                  border: '1px solid var(--glass-border)', 
                  background: 'var(--surface)',
                  fontWeight: '700',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B2FA0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.7rem center',
                  boxShadow: 'var(--shadow)'
                }}
              >
                <option value="all">Todos los productos ({orders.length})</option>
                {products.map(p => {
                  const count = orders.filter(o => o.items?.some((item: any) => item.producto_id === p.id)).length;
                  return (
                    <option key={p.id} value={p.id}>{p.nombre} ({count})</option>
                  );
                })}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setShowManualOrderForm(true)}
                className="btn-view"
                style={{ width: 'auto', padding: '0.5rem 1rem' }}
              >
                <Plus size={16} /> Pedido Manual
              </button>
              {orders.length > 0 && (
                <button 
                  onClick={handleDeleteAllOrders}
                  className="delete-btn"
                  style={{ background: 'rgba(212, 68, 42, 0.1)', color: '#D4442A', border: '1px solid rgba(212,68,42,0.2)', padding: '0.5rem 1rem', width: 'auto' }}
                >
                  <Trash2 size={16} /> Borrar Todo
                </button>
              )}
            </div>
          </div>
          {orders.length === 0 && <div className="empty-state"><ShoppingBag size={48} /><p>No hay pedidos aún</p></div>}
          {orders.length > 0 && orders.filter(order => {
            if (filterProductId === 'all') return true
            return order.items?.some((item: any) => item.producto_id === filterProductId)
          }).length === 0 && (
            <div className="empty-state" style={{ padding: '4rem 1rem' }}>
              <AlertCircle size={48} color="var(--text-muted)" style={{ opacity: 0.5 }} />
              <p>No hay pedidos para este producto</p>
              <button onClick={() => setFilterProductId('all')} className="btn-view" style={{ width: 'auto', marginTop: '1rem', padding: '0.5rem 1rem' }}>Ver todos</button>
            </div>
          )}
          {orders
            .filter(order => {
              if (filterProductId === 'all') return true
              return order.items?.some((item: any) => item.producto_id === filterProductId)
            })
            .map(order => (
            <div key={order.id} className="glass order-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: 'var(--primary)' }}>{order.cliente_nombre} {order.apellido}</h3>
                  {order.telefono && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0.2rem 0' }}>
                      <Phone size={12} /> {order.telefono}
                    </div>
                  )}
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(order.created_at).toLocaleDateString('es-AR')} — Total: <strong>${order.total.toLocaleString()}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => toggleStatus(order)}
                  className={`status-badge ${order.estado}`}
                  disabled={updatingOrders.has(order.id)}
                  style={{ 
                    cursor: updatingOrders.has(order.id) ? 'wait' : 'pointer', 
                    border: 'none',
                    transition: 'all 0.2s ease',
                    transform: 'scale(1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    opacity: updatingOrders.has(order.id) ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => !updatingOrders.has(order.id) && (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {updatingOrders.has(order.id) ? '...' : order.estado.toUpperCase()}
                </button>
              </div>

              {/* Items */}
              {order.items && order.items.length > 0 && (
                <div style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.5)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                  {order.items.map((item: any, i: number) => (
                    <div key={i}>📦 {item.nombre} x{item.cantidad} — ${(item.cantidad * item.precio).toLocaleString()}</div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {order.notas && (
                <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  📝 {order.notas}
                </p>
              )}

              {/* Comprobante */}
              {order.comprobante_url && (
                <div>
                  <a href={order.comprobante_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>
                    🧾 Ver Comprobante
                  </a>
                </div>
              )}

              {/* Admin Notes */}
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Notas Admin (solo para vos)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <textarea 
                    defaultValue={order.admin_notas || ''}
                    placeholder="Escribí una nota interna aquí..."
                    className="glass"
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', height: '40px' }}
                    onBlur={(e) => {
                      if (e.target.value !== (order.admin_notas || '')) {
                        handleUpdateAdminNotes(order.id, e.target.value)
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Order Modal */}
      {showManualOrderForm && (
        <div className="modal-overlay" onClick={() => setShowManualOrderForm(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Nuevo Pedido Manual</h3>
              <button onClick={() => setShowManualOrderForm(false)} className="icon-btn"><X size={20} /></button>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Nombre *</label>
                <input type="text" value={manualOrder.cliente_nombre} onChange={(e) => setManualOrder({...manualOrder, cliente_nombre: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Apellido *</label>
                <input type="text" value={manualOrder.apellido} onChange={(e) => setManualOrder({...manualOrder, apellido: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" placeholder="Opcional" value={manualOrder.telefono} onChange={(e) => setManualOrder({...manualOrder, telefono: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Producto *</label>
              <select 
                value={manualOrder.producto_id} 
                onChange={(e) => setManualOrder({...manualOrder, producto_id: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '2px solid var(--glass-border)', background: 'var(--surface)', fontSize: '0.95rem' }}
              >
                <option value="">Seleccione un producto...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.nombre} (${p.precio})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Cantidad *</label>
              <input type="number" min="1" value={manualOrder.cantidad} onChange={(e) => setManualOrder({...manualOrder, cantidad: parseInt(e.target.value) || 1})} />
            </div>

            <div className="form-group">
              <label>Notas (Opcional)</label>
              <textarea value={manualOrder.notas} onChange={(e) => setManualOrder({...manualOrder, notas: e.target.value})} rows={2} />
            </div>

            <button className="primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleSubmitManualOrder} disabled={saving}>
              {saving ? 'Creando...' : 'Crear Pedido Manual'}
            </button>
          </div>
        </div>
      )}


      {tab === 'products' && (
        <>
          {showForm && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                  <h3>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                  <button onClick={closeModal} className="icon-btn"><X size={20} /></button>
                </div>

                <div className="form-group">
                  <label>Nombre *</label>
                  <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Descripción</label>
                  <textarea 
                    value={form.descripcion} 
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })} 
                    rows={3} 
                    placeholder="Ej: Docena de empanadas surtidas..."
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Precio *</label>
                    <input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Stock</label>
                    <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                  </div>
                </div>

                <div className="form-group" style={{ background: 'var(--primary-light)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                  <label style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Cantidades y Precios (Promociones)</label>
                  
                  {form.precios_bulk.map((pb, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cantidad</span>
                        <input 
                          type="number" 
                          min="1" 
                          value={pb.cantidad || ''} 
                          onChange={(e) => {
                            const newBulk = [...form.precios_bulk]
                            newBulk[idx].cantidad = parseInt(e.target.value) || 0
                            setForm({ ...form, precios_bulk: newBulk })
                          }} 
                          style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Precio Total ($)</span>
                        <input 
                          type="number" 
                          min="0" 
                          value={pb.precio_total || ''} 
                          onChange={(e) => {
                            const newBulk = [...form.precios_bulk]
                            newBulk[idx].precio_total = parseFloat(e.target.value) || 0
                            setForm({ ...form, precios_bulk: newBulk })
                          }} 
                          style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <button 
                        className="delete-btn" 
                        style={{ alignSelf: 'flex-end', height: '36px', width: '36px', padding: 0 }}
                        onClick={() => {
                          setForm({ ...form, precios_bulk: form.precios_bulk.filter((_, i) => i !== idx) })
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button 
                    style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.5rem' }}
                    onClick={() => setForm({ ...form, precios_bulk: [...form.precios_bulk, { cantidad: 0, precio_total: 0 }] })}
                  >
                    <Plus size={16} /> Agregar opción de cantidad
                  </button>
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                    Si un cliente elige una cantidad que está en esta lista, se le cobrará el Precio Total exacto que definas aquí.
                  </small>
                </div>

                <div className="form-group">
                  <label>Imágenes</label>
                  <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={24} />
                    <p>{uploading ? 'Subiendo...' : 'Click para subir imágenes'}</p>
                    <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                  </div>
                  <div className="image-preview-grid">
                    {form.imagenes.map((url, idx) => (
                      <div key={idx} className="preview-thumb">
                        <img src={url} alt="" />
                        <button onClick={() => removeImage(idx)} className="remove-img"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="primary" style={{ width: '100%' }} onClick={handleSubmitProduct} disabled={saving || uploading}>
                  {saving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </div>
          )}

          <div className="grid">
            {products.map(p => <ProductCard p={p} key={p.id} onEdit={openEditModal} onDelete={handleDeleteProduct} deleting={deleting} />)}
            <button className="add-product-card" onClick={() => setShowForm(true)}><Plus size={36} /><p>Nuevo Producto</p></button>
          </div>
        </>
      )}

      {tab === 'config' && (
        <div className="glass" style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Settings size={20} /> Configuración Global
          </h3>
          
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Phone size={16} /> Número de WhatsApp
            </label>
            <input 
              type="text" 
              placeholder="Ej: 5491162426916"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            <small style={{ color: 'var(--text-muted)' }}>Incluir código de país y área sin símbolos (ej: 549...)</small>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Datos Bancarios de Transferencia</label>
            <textarea 
              placeholder="Ej: ALIAS: mipanaderia.mp&#10;CBU: 0000000000000000"
              value={datosBancarios}
              onChange={(e) => setDatosBancarios(e.target.value)}
              rows={4}
            />
            <small style={{ color: 'var(--text-muted)' }}>Esta información la verán los clientes antes de subir el comprobante.</small>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Texto de sugerencia en Notas (Placeholder)</label>
            <input 
              type="text" 
              placeholder="Ej: Talle, color, horario de entrega..."
              value={notasPlaceholder}
              onChange={(e) => setNotasPlaceholder(e.target.value)}
            />
            <small style={{ color: 'var(--text-muted)' }}>Esto aparecerá en gris claro en la caja de Notas del formulario de pedido.</small>
          </div>

          <button className="primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleSaveConfig} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      )}
    </div>
  )
}

function ProductCard({ p, onEdit, onDelete, deleting }: { p: Product, onEdit: (p: Product) => void, onDelete: (id: string) => void, deleting: string | null }) {
  const [currentImg, setCurrentImg] = useState(0)
  const imagenes = p.imagenes && p.imagenes.length > 0 ? p.imagenes : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600']

  return (
    <div className="glass product-card-admin">
      <div style={{ position: 'relative', height: '160px' }}>
        <img src={imagenes[currentImg]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
        {imagenes.length > 1 && (
          <div className="carousel-dots">
            {imagenes.map((_, i) => <div key={i} className={`dot ${i === currentImg ? 'active' : ''}`} />)}
          </div>
        )}
      </div>
      <h4 style={{ marginTop: '0.75rem' }}>{p.nombre}</h4>
      <p style={{ fontWeight: 'bold', color: 'var(--primary)' }}>${p.precio.toLocaleString()}</p>
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button className="icon-btn" onClick={() => onEdit(p)} style={{ flex: 1, background: 'var(--primary-light)' }}><ImageIcon size={16} /> Editar</button>
        <button className="delete-btn" onClick={() => onDelete(p.id)} disabled={deleting === p.id} style={{ flex: 1 }}><Trash2 size={16} /></button>
      </div>
    </div>
  )
}
