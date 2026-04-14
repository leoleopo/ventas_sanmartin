import { useState } from 'react'
import { Product } from './services/productService'
import Catalog from './components/Catalog'
import ProductDetail from './components/ProductDetail'
import AdminDashboard from './components/Admin/Dashboard'
import Login from './components/Admin/Login'
import { ShoppingBag, Settings } from 'lucide-react'

type View = 'catalog' | 'product' | 'admin' | 'login'

function App() {
  const [view, setView] = useState<View>('catalog')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const handleLogin = (pass: string) => {
    if (pass === 'admin123') {
      setIsAuthenticated(true)
      setView('admin')
    } else {
      alert('Contraseña incorrecta')
    }
  }

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product)
    setView('product')
    window.scrollTo(0, 0)
  }

  const handleBackToCatalog = () => {
    setSelectedProduct(null)
    setView('catalog')
  }

  return (
    <div className="App">
      <nav className="main-nav">
        <button 
          onClick={handleBackToCatalog} 
          className={`nav-btn ${view === 'catalog' || view === 'product' ? 'active' : ''}`}
        >
          <ShoppingBag size={18} />
          Tienda
        </button>
        <button 
          onClick={() => setView(isAuthenticated ? 'admin' : 'login')} 
          className={`nav-btn ${view === 'admin' || view === 'login' ? 'active' : ''}`}
        >
          <Settings size={18} />
          Admin
        </button>
      </nav>

      {view === 'catalog' && <Catalog onViewProduct={handleViewProduct} />}
      {view === 'product' && selectedProduct && (
        <ProductDetail product={selectedProduct} onBack={handleBackToCatalog} />
      )}
      {view === 'login' && <Login onLogin={handleLogin} />}
      {view === 'admin' && isAuthenticated && <AdminDashboard />}

      <footer>
        &copy; 2026 Venta San Martín
      </footer>
    </div>
  )
}

export default App
