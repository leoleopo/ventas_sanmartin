import { useState, useRef } from 'react'
import { Product, productService } from '../services/productService'
import { orderService } from '../services/orderService'
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle, Upload, CheckCircle, X, Plus, Minus, Trash2 } from 'lucide-react'

interface Props {
  product: Product
  onBack: () => void
}

interface PedidoItem {
  descripcion: string
  valor: number
  cantidad: number | ''
  checked?: boolean
}

export default function ProductDetail({ product, onBack }: Props) {
  const [currentImg, setCurrentImg] = useState(0)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [notas, setNotas] = useState('')
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Load items depending on whether the product is multiple or not
  const [items, setItems] = useState<PedidoItem[]>(() => {
    if (product.es_multiple && product.items_multiples?.length) {
      return product.items_multiples.map(item => ({
        descripcion: item.descripcion,
        valor: item.valor,
        cantidad: 1,
        checked: false
      }))
    }
    return [{ descripcion: '', valor: 0, cantidad: 1 }]
  })

  // Quantities for standard product
  const cantidades = (product.precios_bulk && product.precios_bulk.length > 0)
    ? product.precios_bulk.map(pb => pb.cantidad)
    : (product.cantidades || [6, 12, 18, 24])

  const [qty, setQty] = useState<number | ''>(() => {
    return cantidades[0] || 6
  })

  const getBulkPrice = (q: number) => {
    const promo = product.precios_bulk?.find(pb => pb.cantidad === q)
    return promo ? promo.precio_total : q * product.precio
  }

  const total = product.es_multiple
    ? items.reduce((sum, item) => sum + (item.checked ? item.valor * (Number(item.cantidad) || 0) : 0), 0)
    : getBulkPrice(Number(qty) || 0)

  const imagenes = product.imagenes?.length > 0 ? product.imagenes : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600']

  // Manual items controls (Only used as backup or if es_multiple is false but they wanted to add manually, though we keep standard product simple now)
  const addItem = () => {
    setItems([...items, { descripcion: '', valor: 0, cantidad: 1 }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof PedidoItem, value: string | number) => {
    const newItems = [...items]
    if (field === 'descripcion') {
      newItems[index].descripcion = value as string
    } else if (field === 'valor') {
      newItems[index].valor = parseFloat(value as string) || 0
    } else if (field === 'cantidad') {
      newItems[index].cantidad = parseInt(value as string) || 1
    }
    setItems(newItems)
  }

  const handleComprobanteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setComprobante(file)
      setComprobantePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async () => {
    if (!nombre.trim() || !apellido.trim()) {
      setError('Por favor completá nombre y apellido')
      return
    }

    const validItems = product.es_multiple
      ? items
          .filter(item => item.checked && (Number(item.cantidad) || 0) > 0)
          .map(item => ({
            descripcion: item.descripcion,
            valor: item.valor,
            cantidad: Number(item.cantidad) || 1
          }))
      : [{
          descripcion: product.nombre,
          valor: getBulkPrice(Number(qty) || 1) / (Number(qty) || 1),
          cantidad: Number(qty) || 1
        }]

    if (validItems.length === 0) {
      setError(product.es_multiple ? 'Seleccioná al menos un artículo de la lista' : 'La cantidad debe ser mayor a 0')
      return
    }

    if (!comprobante) {
      setError('Subí el comprobante de transferencia')
      return
    }

    setSending(true)
    setError('')

    try {
      // Upload comprobante
      const comprobanteUrl = await orderService.uploadComprobante(comprobante)

      // Create order in database
      await orderService.createOrder({
        cliente_nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: '',
        notas: notas.trim(),
        admin_notas: '',
        total,
        comprobante_url: comprobanteUrl,
        items: validItems.map(item => ({
          producto_id: product.id,
          nombre: item.descripcion,
          cantidad: item.cantidad,
          precio: item.valor
        }))
      })

      // Send WhatsApp
      const itemsText = validItems.map(item =>
        `  • ${item.descripcion} — ${item.cantidad} x $${item.valor.toLocaleString()} = $${(item.cantidad * item.valor).toLocaleString()}`
      ).join('\n')

      const message = encodeURIComponent(
        `*Nuevo Pedido - San Martín*\n\n` +
        `*Cliente:* ${nombre} ${apellido}\n` +
        `*Producto:* ${product.nombre}\n\n` +
        `*Detalle del pedido:*\n${itemsText}\n\n` +
        `*Total:* $${total.toLocaleString()}\n` +
        (notas ? `*Notas:* ${notas}\n` : '') +
        `\n_Comprobante adjuntado en el sistema._`
      )

      const whatsapp = product.whatsapp_numero || ''
      window.open(`https://wa.me/${whatsapp}?text=${message}`, '_blank')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pedido')
    } finally {
      setSending(false)
    }
  }

  if (success) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="success-card">
          <CheckCircle size={64} color="#25D366" />
          <h2>¡Pedido Realizado!</h2>
          <p>Tu pedido fue registrado exitosamente.<br />Te redirigimos a WhatsApp para confirmar.</p>
          <button className="btn-primary" onClick={onBack} style={{ marginTop: '1.5rem' }}>
            Volver a la Tienda
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container product-detail-container">
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={20} />
        Volver al Catálogo
      </button>

      <div className="product-detail">
        {/* Image Gallery */}
        <div className="detail-gallery">
          <div className="detail-main-image">
            <img src={imagenes[currentImg]} alt={product.nombre} />
            {imagenes.length > 1 && (
              <>
                <button className="carousel-btn left" onClick={() => setCurrentImg((currentImg - 1 + imagenes.length) % imagenes.length)}>
                  <ChevronLeft size={22} />
                </button>
                <button className="carousel-btn right" onClick={() => setCurrentImg((currentImg + 1) % imagenes.length)}>
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>
          {imagenes.length > 1 && (
            <div className="detail-thumbs">
              {imagenes.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className={i === currentImg ? 'active' : ''}
                  onClick={() => setCurrentImg(i)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Product Info & Order Form */}
        <div className="detail-info">
          <h1 className="detail-title">{product.nombre}</h1>
          {!product.es_multiple && <div className="detail-price">${product.precio.toLocaleString()}</div>}
          <p className="detail-desc">{product.descripcion}</p>

          <div className="order-section">
            <h3>Hacer Pedido</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Nombre *</label>
                <input type="text" placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Apellido *</label>
                <input type="text" placeholder="Tu apellido" value={apellido} onChange={e => setApellido(e.target.value)} />
              </div>
            </div>

            {/* Product Configuration: es_multiple checklist vs standard bulk quantities */}
            {product.es_multiple ? (
              <div className="multi-items-section">
                <label style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem', display: 'block' }}>
                  Elegí tus artículos *
                </label>
                
                <div className="multiple-checklist">
                  {items.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`checklist-row ${item.checked ? 'checked' : ''}`}
                    >
                      <input 
                        type="checkbox" 
                        className="checklist-checkbox"
                        checked={item.checked || false}
                        onChange={(e) => {
                          const newItems = [...items]
                          newItems[idx].checked = e.target.checked
                          setItems(newItems)
                        }}
                      />
                      
                      <span 
                        className="checklist-desc"
                        onClick={() => {
                          const newItems = [...items]
                          newItems[idx].checked = !newItems[idx].checked
                          setItems(newItems)
                        }}
                      >
                        {item.descripcion}
                      </span>
                      
                      <span className="checklist-value">
                        ${item.valor.toLocaleString()} c/u
                      </span>
                      
                      <div className="checklist-qty-container">
                        <div className={`quantity-counter ${!item.checked ? 'disabled' : ''}`}>
                          <button
                            type="button"
                            className="counter-btn"
                            disabled={!item.checked || (Number(item.cantidad) || 1) <= 1}
                            onClick={() => {
                              const newItems = [...items]
                              newItems[idx].cantidad = Math.max(1, (Number(item.cantidad) || 1) - 1)
                              setItems(newItems)
                            }}
                          >
                            <Minus size={14} />
                          </button>
                          <input 
                            type="number" 
                            min="1" 
                            className="counter-qty-input"
                            value={item.cantidad}
                            disabled={!item.checked}
                            onChange={(e) => {
                              const valStr = e.target.value
                              const newItems = [...items]
                              if (valStr === '') {
                                newItems[idx].cantidad = ''
                              } else {
                                const parsed = parseInt(valStr)
                                newItems[idx].cantidad = isNaN(parsed) ? 1 : parsed
                              }
                              setItems(newItems)
                            }}
                            onBlur={(e) => {
                              const valStr = e.target.value
                              const parsed = parseInt(valStr) || 1
                              const newItems = [...items]
                              newItems[idx].cantidad = Math.max(1, parsed)
                              setItems(newItems)
                            }}
                          />
                          <button
                            type="button"
                            className="counter-btn"
                            disabled={!item.checked}
                            onClick={() => {
                              const newItems = [...items]
                              newItems[idx].cantidad = (Number(item.cantidad) || 0) + 1
                              setItems(newItems)
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <span className="checklist-total">
                        ${(item.valor * (Number(item.cantidad) || 0)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem', display: 'block' }}>
                  Cantidad
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {cantidades.map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQty(q)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${qty === q ? 'var(--primary)' : 'var(--glass-border)'}`,
                        background: qty === q ? 'var(--primary-light)' : 'var(--surface)',
                        color: qty === q ? 'var(--primary)' : 'var(--text)',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {q} U. {product.precios_bulk?.some(pb => pb.cantidad === q) && <span style={{ fontSize: '0.7rem', color: 'var(--accent)', marginLeft: '0.2rem' }}>(Promo)</span>}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Otra cantidad:</span>
                  <div className="quantity-counter" style={{ height: '36px' }}>
                    <button
                      type="button"
                      className="counter-btn"
                      disabled={(Number(qty) || 1) <= 1}
                      onClick={() => setQty(Math.max(1, (Number(qty) || 1) - 1))}
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      className="counter-qty-input"
                      value={qty}
                      onChange={(e) => {
                        const valStr = e.target.value
                        if (valStr === '') {
                          setQty('')
                        } else {
                          const parsed = parseInt(valStr)
                          setQty(isNaN(parsed) ? 1 : parsed)
                        }
                      }}
                      onBlur={(e) => {
                        const valStr = e.target.value
                        const parsed = parseInt(valStr) || 1
                        setQty(Math.max(1, parsed))
                      }}
                      style={{ width: '3rem' }}
                    />
                    <button
                      type="button"
                      className="counter-btn"
                      onClick={() => setQty((Number(qty) || 0) + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {total > 0 && (
              <div className="order-total" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                Total del Pedido: <strong>${total.toLocaleString()}</strong>
              </div>
            )}

            {product.datos_bancarios && (
              <div className="bank-details-box" style={{ background: 'var(--accent-soft)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Datos para Transferencia
                </h4>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                  {product.datos_bancarios}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Comprobante de Transferencia *</label>
              <div className="upload-area" onClick={() => fileRef.current?.click()}>
                {comprobantePreview ? (
                  <div className="comprobante-preview">
                    <img src={comprobantePreview} alt="Comprobante" />
                    <button className="remove-img" onClick={(e) => { e.stopPropagation(); setComprobante(null); setComprobantePreview('') }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={28} />
                    <p>Subí tu comprobante aquí</p>
                    <small>Foto o captura de pantalla</small>
                  </>
                )}
                <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={handleComprobanteChange} />
              </div>
            </div>

            <div className="form-group">
              <label>Notas (opcional)</label>
              <textarea 
                placeholder={product.notas_placeholder || "Talle, color, horario de entrega..."} 
                value={notas} 
                onChange={e => setNotas(e.target.value)} 
                rows={2} 
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button className="btn-whatsapp-order" onClick={handleSubmit} disabled={sending}>
              <MessageCircle size={22} />
              {sending ? 'Procesando...' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
