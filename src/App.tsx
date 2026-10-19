import { useState, useEffect } from 'react'
import { Product } from './services/productService'
import Catalog from './components/Catalog'
import ProductDetail from './components/ProductDetail'
import AdminDashboard from './components/Admin/Dashboard'
import Login from './components/Admin/Login'
import { supabase } from './lib/supabase'
import { ShoppingBag, Settings, LogOut } from 'lucide-react'

type View = 'catalog' | 'product' | 'admin' | 'login'

function App() {
  const [view, setView] = useState<View>('catalog')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (email: string, password: string) => {
    setLoginLoading(true)
    setLoginError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setIsAuthenticated(true)
      setView('admin')
    } catch (err: any) {
      setLoginError(err?.message || 'No pudimos verificar tus credenciales')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setView('catalog')
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
        {isAuthenticated && (
          <button onClick={handleLogout} className="nav-btn">
            <LogOut size={18} />
            Salir
          </button>
        )}
      </nav>

      {view === 'catalog' && <Catalog onViewProduct={handleViewProduct} />}
      {view === 'product' && selectedProduct && (
        <ProductDetail product={selectedProduct} onBack={handleBackToCatalog} />
      )}
      {view === 'login' && (
        <Login onLogin={handleLogin} error={loginError} loading={loginLoading} />
      )}
      {view === 'admin' && isAuthenticated && <AdminDashboard />}

      <footer>
        &copy; 2026 Venta San Martín
      </footer>
    </div>
  )
}

export default App
