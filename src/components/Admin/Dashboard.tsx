import { useState, useEffect, useRef } from 'react'
import { orderService, Order } from '../../services/orderService'
import { productService, Product } from '../../services/productService'
import { CheckCircle, Clock, Package, Plus, Trash2, X, ShoppingBag, AlertCircle, Upload, ChevronLeft, ChevronRight, Image as ImageIcon, Phone, Settings, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react'

interface ProductForm {
  nombre: string
  descripcion: string
  precio: string
  imagenes: string[]
  stock: string
  precios_bulk: { cantidad: number, precio_total: number }[]
  whatsapp_numero: string
  datos_bancarios: string
  notas_placeholder: string
  activo: boolean
  es_multiple: boolean
  items_multiples: { descripcion: string, valor: number }[]
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
  ],
  whatsapp_numero: '',
  datos_bancarios: '',
  notas_placeholder: '',
  activo: true,
  es_multiple: false,
  items_multiples: [
    { descripcion: '', valor: 0 }
  ]
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tab, setTab] = useState<'orders' | 'products'>('orders')
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
    cliente_nombre: '', apellido: '', telefono: '', notas: '',
    items: [{ descripcion: '', valor: 0, cantidad: 1 }] as { descripcion: string, valor: number, cantidad: number }[]
  })
  const [filterProductId, setFilterProductId] = useState<string>('all')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refreshData()
  }, [])

  const refreshData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [o, p] = await Promise.all([
        orderService.getAll(), 
        productService.getAll(true)
      ])
      setOrders(o)
      setProducts(p)
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

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('🚨 ¿Estás seguro de que querés borrar este pedido?')) return
    
    setUpdatingOrders(prev => new Set(prev).add(id))
    setError(null)
    try {
      await orderService.deleteOrder(id)
      await refreshData(false)
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el pedido')
    } finally {
      setUpdatingOrders(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDeleteAllOrders = async () => {
    const isFiltered = filterProductId !== 'all'
    const msg = isFiltered 
      ? '🚨 ¿Estás SEGURO de que querés borrar TODOS los pedidos DEL PRODUCTO SELECCIONADO? Esta acción no se puede deshacer.'
      : '🚨 ¿Estás SEGURO de que querés borrar TODOS los pedidos? Esta acción no se puede deshacer.'
    
    if (!confirm(msg)) return
    
    setLoading(true)
    setError(null)
    try {
      await orderService.deleteAllOrders(isFiltered ? filterProductId : undefined)
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

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...form.items_multiples]
    if (direction === 'up' && index > 0) {
      const temp = newItems[index]
      newItems[index] = newItems[index - 1]
      newItems[index - 1] = temp
    } else if (direction === 'down' && index < newItems.length - 1) {
      const temp = newItems[index]
      newItems[index] = newItems[index + 1]
      newItems[index + 1] = temp
    }
    setForm(prev => ({ ...prev, items_multiples: newItems }))
  }

  const handleSubmitProduct = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre del producto es obligatorio')
      return
    }

    if (!form.es_multiple && !form.precio.trim()) {
      setError('El precio es obligatorio')
      return
    }

    if (form.es_multiple) {
      const validItems = form.items_multiples.filter(item => item.descripcion.trim() && item.valor > 0)
      if (validItems.length === 0) {
        setError('Para una publicación múltiple, debes agregar al menos un artículo con descripción y valor')
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      const productData = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        precio: form.es_multiple ? 0 : (parseFloat(form.precio) || 0),
        imagenes: form.imagenes.length > 0 ? form.imagenes : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600'],
        stock: form.es_multiple ? 0 : (parseInt(form.stock) || 0),
        activo: form.activo,
        cantidades: form.es_multiple ? [] : form.precios_bulk.map(pb => pb.cantidad).filter(c => c > 0),
        precios_bulk: form.es_multiple ? [] : form.precios_bulk.filter(pb => pb.cantidad > 0),
        whatsapp_numero: form.whatsapp_numero.trim(),
        datos_bancarios: form.datos_bancarios.trim(),
        notas_placeholder: form.notas_placeholder.trim(),
        es_multiple: form.es_multiple,
        items_multiples: form.es_multiple ? form.items_multiples.filter(item => item.descripcion.trim()) : []
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

  const handleSubmitManualOrder = async () => {
    if (!manualOrder.cliente_nombre.trim() || !manualOrder.apellido.trim()) {
      setError('Nombre y apellido son obligatorios')
      return
    }

    const validItems = manualOrder.items.filter(item => item.descripcion.trim() && item.valor > 0 && item.cantidad > 0)
    if (validItems.length === 0) {
      setError('Agregá al menos un ítem con descripción, valor y cantidad')
      return
    }

    setSaving(true)
    setError(null)
    const total = validItems.reduce((sum, item) => sum + (item.valor * item.cantidad), 0)
    
    try {
      await orderService.createOrder({
        cliente_nombre: manualOrder.cliente_nombre.trim(),
        apellido: manualOrder.apellido.trim(),
        telefono: manualOrder.telefono.trim(),
        notas: manualOrder.notas.trim(),
        admin_notas: 'Pedido manual agregado desde Admin',
        total,
        comprobante_url: 'Pedido Manual',
        items: validItems.map(item => ({
          producto_id: 'manual',
          nombre: item.descripcion,
          cantidad: item.cantidad,
          precio: item.valor
        }))
      } as any)
      
      setShowManualOrderForm(false)
      setManualOrder({
        cliente_nombre: '', apellido: '', telefono: '', notas: '',
        items: [{ descripcion: '', valor: 0, cantidad: 1 }]
      })
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
      precios_bulk: p.precios_bulk?.length ? p.precios_bulk : (p.cantidades || [6, 12, 18, 24]).map(c => ({ cantidad: c, precio_total: c * p.precio })),
      whatsapp_numero: p.whatsapp_numero || '',
      datos_bancarios: p.datos_bancarios || '',
      notas_placeholder: p.notas_placeholder || '',
      activo: p.activo,
      es_multiple: p.es_multiple || false,
      items_multiples: p.items_multiples?.length ? p.items_multiples : [{ descripcion: '', valor: 0 }]
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

  const handleToggleActiveProduct = async (id: string, currentStatus: boolean) => {
    setError(null)
    try {
      await productService.updateProduct(id, { activo: !currentStatus })
      setProducts(prev => prev.map(p => p.id === id ? { ...p, activo: !currentStatus } : p))
    } catch (err: any) {
      setError(err.message || 'Error al actualizar estado del producto')
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
                  <Trash2 size={16} /> {filterProductId === 'all' ? 'Borrar Todo' : 'Borrar Filtrados'}
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
            <div key={order.id} className="glass order-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', position: 'relative' }}>
              <button 
                onClick={() => handleDeleteOrder(order.id)} 
                className="delete-btn" 
                disabled={updatingOrders.has(order.id)}
                style={{ position: 'absolute', top: '1rem', right: '1rem', width: '32px', height: '32px', padding: 0 }}
                title="Eliminar pedido"
              >
                <Trash2 size={16} />
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '40px' }}>
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
          <div className="modal glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Nuevo Pedido Manual</h3>
              <button onClick={() => setShowManualOrderForm(false)} className="icon-btn"><X size={20} /></button>
            </div>

            {error && (
              <div className="error-banner" style={{ margin: '1rem 0' }}>
                <AlertCircle size={20} color="#DC2626" />
                <span style={{ color: '#991B1B', flex: 1 }}>{error}</span>
                <button onClick={() => setError(null)} style={{ background: 'none' }}><X size={16} /></button>
              </div>
            )}
            
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

            {/* Multi-item section */}
            <div className="multi-items-section">
              <label style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem', display: 'block' }}>
                Artículos del Pedido
              </label>

              {manualOrder.items.map((item, index) => (
                <div key={index} className="multi-item-row">
                  <div className="multi-item-fields">
                    <div className="multi-item-field multi-item-desc">
                      <span className="field-label">Descripción</span>
                      <input
                        type="text"
                        placeholder="Ej: Empanadas de carne"
                        value={item.descripcion}
                        onChange={(e) => {
                          const newItems = [...manualOrder.items]
                          newItems[index] = { ...newItems[index], descripcion: e.target.value }
                          setManualOrder({ ...manualOrder, items: newItems })
                        }}
                      />
                    </div>
                    <div className="multi-item-field multi-item-val">
                      <span className="field-label">Valor ($)</span>
                      <input
                        type="number"
                        min="0"
                        value={item.valor || ''}
                        onChange={(e) => {
                          const newItems = [...manualOrder.items]
                          newItems[index] = { ...newItems[index], valor: parseFloat(e.target.value) || 0 }
                          setManualOrder({ ...manualOrder, items: newItems })
                        }}
                      />
                    </div>
                    <div className="multi-item-field multi-item-qty">
                      <span className="field-label">Cantidad</span>
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => {
                          const newItems = [...manualOrder.items]
                          newItems[index] = { ...newItems[index], cantidad: parseInt(e.target.value) || 1 }
                          setManualOrder({ ...manualOrder, items: newItems })
                        }}
                      />
                    </div>
                  </div>
                  <div className="multi-item-subtotal">
                    <span className="field-label">Subtotal</span>
                    <span className="subtotal-value">${(item.valor * item.cantidad).toLocaleString()}</span>
                  </div>
                  {manualOrder.items.length > 1 && (
                    <button
                      className="multi-item-remove"
                      onClick={() => {
                        setManualOrder({
                          ...manualOrder,
                          items: manualOrder.items.filter((_, i) => i !== index)
                        })
                      }}
                      title="Eliminar ítem"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}

              <button 
                className="multi-item-add" 
                onClick={() => setManualOrder({
                  ...manualOrder,
                  items: [...manualOrder.items, { descripcion: '', valor: 0, cantidad: 1 }]
                })}
              >
                <Plus size={18} />
                Agregar otro artículo
              </button>
            </div>

            {manualOrder.items.reduce((sum, item) => sum + (item.valor * item.cantidad), 0) > 0 && (
              <div className="order-total" style={{ marginTop: '1rem' }}>
                Total: <strong>${manualOrder.items.reduce((sum, item) => sum + (item.valor * item.cantidad), 0).toLocaleString()}</strong>
              </div>
            )}

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
            <div className="modal-overlay" onClick={closeModal} style={{ padding: '2rem 1rem' }}>
              <div className="modal glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header">
                  <h3>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                  <button onClick={closeModal} className="icon-btn"><X size={20} /></button>
                </div>

                {error && (
                  <div className="error-banner" style={{ margin: '1rem 0' }}>
                    <AlertCircle size={20} color="#DC2626" />
                    <span style={{ color: '#991B1B', flex: 1 }}>{error}</span>
                    <button onClick={() => setError(null)} style={{ background: 'none' }}><X size={16} /></button>
                  </div>
                )}

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

                {!form.es_multiple && (
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
                )}

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', margin: '1rem 0' }}>
                  <input 
                    type="checkbox" 
                    id="es_multiple" 
                    checked={form.es_multiple} 
                    onChange={(e) => setForm({ ...form, es_multiple: e.target.checked })} 
                    style={{ margin: 0, height: '1.2rem', width: '1.2rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="es_multiple" style={{ cursor: 'pointer', margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'var(--primary)' }}>
                    ¿Es una publicación múltiple (lista de artículos)?
                  </label>
                </div>

                {form.es_multiple ? (
                  <div className="form-group" style={{ background: 'var(--primary-light)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)' }}>
                    <label style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: '800' }}>Artículos Predefinidos</label>
                    
                    {form.items_multiples.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <div style={{ flex: 3 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Descripción</span>
                          <input 
                            type="text" 
                            placeholder="Ej: Empanada de Carne"
                            value={item.descripcion || ''} 
                            onChange={(e) => {
                              const newItems = [...form.items_multiples]
                              newItems[idx].descripcion = e.target.value
                              setForm({ ...form, items_multiples: newItems })
                            }} 
                            style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div style={{ flex: 1.5 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valor ($)</span>
                          <input 
                            type="number" 
                            min="0" 
                            placeholder="800"
                            value={item.valor || ''} 
                            onChange={(e) => {
                              const newItems = [...form.items_multiples]
                              newItems[idx].valor = parseFloat(e.target.value) || 0
                              setForm({ ...form, items_multiples: newItems })
                            }} 
                            style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: 'flex-end', height: '36px' }}>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 'up')}
                            disabled={idx === 0}
                            style={{ 
                              padding: 0, 
                              height: '17px', 
                              width: '24px', 
                              background: 'var(--primary-light)', 
                              border: '1px solid var(--glass-border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: idx === 0 ? 'not-allowed' : 'pointer',
                              opacity: idx === 0 ? 0.3 : 1
                            }}
                            title="Subir"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 'down')}
                            disabled={idx === form.items_multiples.length - 1}
                            style={{ 
                              padding: 0, 
                              height: '17px', 
                              width: '24px', 
                              background: 'var(--primary-light)', 
                              border: '1px solid var(--glass-border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: idx === form.items_multiples.length - 1 ? 'not-allowed' : 'pointer',
                              opacity: idx === form.items_multiples.length - 1 ? 0.3 : 1
                            }}
                            title="Bajar"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>

                        <button 
                          type="button"
                          className="delete-btn" 
                          style={{ alignSelf: 'flex-end', height: '36px', width: '36px', padding: 0 }}
                          onClick={() => {
                            setForm({ ...form, items_multiples: form.items_multiples.filter((_, i) => i !== idx) })
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.5rem' }}
                      onClick={() => setForm({ ...form, items_multiples: [...form.items_multiples, { descripcion: '', valor: 0 }] })}
                    >
                      <Plus size={16} /> Agregar artículo
                    </button>
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                      Definí los nombres y precios fijos. Los clientes podrán tildar cuáles quieren comprar e indicar la cantidad de cada uno.
                    </small>
                  </div>
                ) : (
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
                )}

                <div className="form-group" style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)', marginTop: '1rem' }}>
                  <label style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Settings size={18} /> Configuración Específica del Producto
                  </label>
                  
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Phone size={14} /> Número de WhatsApp
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ej: 5491162426916"
                      value={form.whatsapp_numero}
                      onChange={(e) => setForm({ ...form, whatsapp_numero: e.target.value })}
                    />
                    <small style={{ color: 'var(--text-muted)' }}>Incluir código de país y área sin símbolos (ej: 549...)</small>
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Datos Bancarios de Transferencia</label>
                    <textarea 
                      placeholder="Ej: ALIAS: mipanaderia.mp&#10;CBU: 0000000000000000"
                      value={form.datos_bancarios}
                      onChange={(e) => setForm({ ...form, datos_bancarios: e.target.value })}
                      rows={3}
                    />
                    <small style={{ color: 'var(--text-muted)' }}>Esta información la verán los clientes antes de subir el comprobante.</small>
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Texto de sugerencia en Notas (Placeholder)</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Talle, color, horario de entrega..."
                      value={form.notas_placeholder}
                      onChange={(e) => setForm({ ...form, notas_placeholder: e.target.value })}
                    />
                    <small style={{ color: 'var(--text-muted)' }}>Aparecerá en gris claro en la caja de Notas del pedido.</small>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
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

                <button className="primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleSubmitProduct} disabled={saving || uploading}>
                  {saving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </div>
          )}

          <div className="grid">
            {products.map(p => <ProductCard p={p} key={p.id} onEdit={openEditModal} onDelete={handleDeleteProduct} onToggleActive={handleToggleActiveProduct} deleting={deleting} />)}
            <button className="add-product-card" onClick={() => setShowForm(true)}><Plus size={36} /><p>Nuevo Producto</p></button>
          </div>
        </>
      )}
    </div>
  )
}

function ProductCard({ p, onEdit, onDelete, onToggleActive, deleting }: { p: Product, onEdit: (p: Product) => void, onDelete: (id: string) => void, onToggleActive: (id: string, activo: boolean) => void, deleting: string | null }) {
  const [currentImg, setCurrentImg] = useState(0)
  const imagenes = p.imagenes && p.imagenes.length > 0 ? p.imagenes : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600']

  return (
    <div className={`glass product-card-admin ${!p.activo ? 'paused' : ''}`} style={{ opacity: p.activo ? 1 : 0.6, position: 'relative' }}>
      <div style={{ position: 'relative', height: '160px' }}>
        <img src={imagenes[currentImg]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
        {!p.activo && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
            PAUSADO
          </div>
        )}
        {imagenes.length > 1 && (
          <div className="carousel-dots">
            {imagenes.map((_, i) => <div key={i} className={`dot ${i === currentImg ? 'active' : ''}`} />)}
          </div>
        )}
      </div>
      <h4 style={{ marginTop: '0.75rem' }}>{p.nombre}</h4>
      <p style={{ fontWeight: 'bold', color: 'var(--primary)' }}>${p.precio.toLocaleString()}</p>
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="icon-btn" onClick={() => onEdit(p)} style={{ flex: '1 1 45%', background: 'var(--primary-light)' }}><ImageIcon size={16} /> Editar</button>
        <button className="icon-btn" onClick={() => onToggleActive(p.id, p.activo)} style={{ flex: '1 1 45%', background: p.activo ? 'rgba(212, 68, 42, 0.1)' : 'rgba(37, 211, 102, 0.1)', color: p.activo ? '#D4442A' : '#25D366' }}>
          {p.activo ? <><EyeOff size={16} /> Pausar</> : <><Eye size={16} /> Activar</>}
        </button>
        <button className="delete-btn" onClick={() => onDelete(p.id)} disabled={deleting === p.id} style={{ flex: '1 1 100%' }}><Trash2 size={16} /> Eliminar</button>
      </div>
    </div>
  )
}
