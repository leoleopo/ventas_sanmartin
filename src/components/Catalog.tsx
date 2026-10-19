import { useState, useEffect, useCallback } from 'react'
import { Product, productService } from '../services/productService'
import { pingDatabase } from '../lib/supabase'
import { ShoppingBag, ChevronLeft, ChevronRight, MessageCircle, Eye, RefreshCw, WifiOff } from 'lucide-react'

interface CatalogProps {
  onViewProduct: (product: Product) => void
}

const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000

export default function Catalog({ onViewProduct }: CatalogProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await productService.getAll()
      setProducts(data)
    } catch (err: any) {
      setError(err?.message || 'No pudimos cargar los productos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        pingDatabase().catch(() => {})
      }
    }, KEEPALIVE_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [])

  if (loading) return (
    <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <div className="loading-spinner"></div>
    </div>
  )

  if (error) return (
    <div className="container">
      <div className="empty-state">
        <WifiOff size={48} />
        <h2>Sin conexión con la base de datos</h2>
        <p style={{ marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn-view" onClick={loadProducts} style={{ margin: '0 auto' }}>
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    </div>
  )

  return (
    <div className="container">
      <header className="catalog-header">
        <div className="header-decoration">
          <ShoppingBag size={100} />
        </div>
        <h1>San Martín</h1>
        <p className="subtitle">Tienda Oficial • Campaña 2026</p>
      </header>

      <div className="grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} onView={() => onViewProduct(product)} />
        ))}
      </div>
    </div>
  )
}

function ProductCard({ product, onView }: { product: Product, onView: () => void }) {
  const [currentImg, setCurrentImg] = useState(0)
  const imagenes = product.imagenes?.length > 0 ? product.imagenes : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600']

  return (
    <div className="product-card" onClick={onView}>
      <div className="card-image">
        <img src={imagenes[currentImg]} alt={product.nombre} />
        {imagenes.length > 1 && (
          <>
            <button className="carousel-btn left" onClick={(e) => { e.stopPropagation(); setCurrentImg((currentImg - 1 + imagenes.length) % imagenes.length) }}>
              <ChevronLeft size={18} />
            </button>
            <button className="carousel-btn right" onClick={(e) => { e.stopPropagation(); setCurrentImg((currentImg + 1) % imagenes.length) }}>
              <ChevronRight size={18} />
            </button>
            <div className="carousel-dots">
              {imagenes.map((_, i) => <div key={i} className={`dot ${i === currentImg ? 'active' : ''}`} />)}
            </div>
          </>
        )}
        <div className="price-badge">${product.precio.toLocaleString()}</div>
      </div>

      <div className="card-body">
        <h3>{product.nombre}</h3>
        <p className="card-desc">{product.descripcion}</p>
        <button className="btn-view">
          <Eye size={16} />
          Ver Producto
        </button>
      </div>
    </div>
  )
}
