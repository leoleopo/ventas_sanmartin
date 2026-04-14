import { useState, useEffect } from 'react'
import { Product, productService, configService } from '../services/productService'
import { ShoppingBag, ChevronLeft, ChevronRight, MessageCircle, Eye } from 'lucide-react'

interface CatalogProps {
  onViewProduct: (product: Product) => void
}

export default function Catalog({ onViewProduct }: CatalogProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    productService.getAll()
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <div className="loading-spinner"></div>
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
