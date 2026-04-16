import { useState, useRef } from 'react'
import { Product, productService, configService, Config } from '../services/productService'
import { orderService } from '../services/orderService'
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle, Upload, CheckCircle, X } from 'lucide-react'

interface Props {
  product: Product
  onBack: () => void
}

export default function ProductDetail({ product, onBack }: Props) {
  const [currentImg, setCurrentImg] = useState(0)
  const [qty, setQty] = useState(0)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [notas, setNotas] = useState('')
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [config, setConfig] = useState<Config | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useState(() => {
    configService.getConfig().then(setConfig)
  })

  const imagenes = product.imagenes?.length > 0 ? product.imagenes : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600']
  const cantidades = product.precios_bulk?.length > 0 ? product.precios_bulk.map(pb => pb.cantidad) : (product.cantidades || [6, 12, 18, 24])
  
  const getBulkPrice = (q: number) => {
    const promo = product.precios_bulk?.find(pb => pb.cantidad === q)
    return promo ? promo.precio_total : q * product.precio
  }
  
  const total = getBulkPrice(qty)

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
    if (qty <= 0) {
      setError('Seleccioná una cantidad')
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
        telefono: '', // Removed from UI, sending empty
        notas: notas.trim(),
        admin_notas: '', // Required by Order interface
        total,
        comprobante_url: comprobanteUrl,
        items: [{
          producto_id: product.id,
          nombre: product.nombre,
          cantidad: qty,
          precio: product.precio
        }]
      })

      // Send WhatsApp
      const message = encodeURIComponent(
        `*Nuevo Pedido - San Martín*\n\n` +
        `*Cliente:* ${nombre} ${apellido}\n` +
        `*Producto:* ${product.nombre}\n` +
        `*Cantidad:* ${qty}\n` +
        `*Total:* $${total.toLocaleString()}\n` +
        (notas ? `*Notas:* ${notas}\n` : '') +
        `\n_Comprobante adjuntado en el sistema._`
      )
      
      window.open(`https://wa.me/${config?.whatsapp_numero}?text=${message}`, '_blank')
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
          <div className="detail-price">${product.precio.toLocaleString()}</div>
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

            <div className="form-group">
              <label>Cantidad *</label>
              <div className="quantity-selector">
                {cantidades.map(q => (
                  <button key={q} className={`q-btn ${qty === q ? 'active' : ''}`} onClick={() => setQty(q)}>
                    {q} un.
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'normal', color: qty === q ? 'inherit' : 'var(--text-muted)' }}>
                      ${getBulkPrice(q).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {qty > 0 && (
              <div className="order-total">
                Total: <strong>${total.toLocaleString()}</strong>
              </div>
            )}

            {config?.datos_bancarios && (
              <div className="bank-details-box" style={{ background: 'var(--accent-soft)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Datos para Transferencia
                </h4>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                  {config.datos_bancarios}
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
                placeholder={config?.notas_placeholder || "Talle, color, horario de entrega..."} 
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
