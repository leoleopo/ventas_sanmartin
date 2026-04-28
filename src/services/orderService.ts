import { supabase } from '../lib/supabase'

export interface OrderItem {
  producto_id: string
  nombre: string
  cantidad: number
  precio: number
}

export interface Order {
  id: string
  cliente_nombre: string
  apellido: string
  telefono: string
  notas: string
  total: number
  estado: 'pendiente' | 'entregado'
  comprobante_url: string
  items: OrderItem[]
  admin_notas: string
  created_at: string
}

export const orderService = {
  async getAll() {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('estado', { ascending: false }) // 'pendiente' (p) comes after 'entregado' (e), so descending puts 'pendiente' first
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Order[]
  },

  async createOrder(order: Omit<Order, 'id' | 'created_at' | 'estado'>) {
    const { data, error } = await supabase
      .from('pedidos')
      .insert([{ ...order, estado: 'pendiente' }])
      .select()
    
    if (error) throw error
    return data[0]
  },

  async updateStatus(id: string, estado: 'pendiente' | 'entregado') {
    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id)
      .select()
    
    if (error) throw error
    return data[0]
  },

  async updateAdminNotes(id: string, admin_notas: string) {
    const { data, error } = await supabase
      .from('pedidos')
      .update({ admin_notas })
      .eq('id', id)
      .select()
    
    if (error) throw error
    return data[0]
  },

  async deleteOrder(id: string) {
    const { data: order } = await supabase.from('pedidos').select('comprobante_url').eq('id', id).single()
    
    if (order?.comprobante_url && !order.comprobante_url.includes('Pedido Manual')) {
      const fileName = order.comprobante_url.split('/').pop()
      if (fileName) {
        await supabase.storage.from('comprobantes').remove([fileName])
      }
    }

    const { error } = await supabase.from('pedidos').delete().eq('id', id)
    if (error) throw error
  },

  async deleteAllOrders(productId?: string) {
    let query = supabase.from('pedidos').select('id, comprobante_url, items')
    const { data: orders } = await query
    
    let ordersToDelete = orders || []
    
    if (productId) {
      ordersToDelete = ordersToDelete.filter(o => 
        o.items && Array.isArray(o.items) && o.items.some((item: any) => item.producto_id === productId)
      )
    }

    if (ordersToDelete.length > 0) {
      const fileNames = ordersToDelete
        .filter(o => o.comprobante_url && !o.comprobante_url.includes('Pedido Manual'))
        .map(o => o.comprobante_url.split('/').pop())
        .filter(Boolean) as string[]
      
      if (fileNames.length > 0) {
        // Break into chunks of 100 for storage.remove
        for (let i = 0; i < fileNames.length; i += 100) {
          await supabase.storage.from('comprobantes').remove(fileNames.slice(i, i + 100))
        }
      }

      const idsToDelete = ordersToDelete.map(o => o.id)
      for (let i = 0; i < idsToDelete.length; i += 100) {
        const chunk = idsToDelete.slice(i, i + 100)
        await supabase.from('pedidos').delete().in('id', chunk)
      }
    }
  },

  async uploadComprobante(file: File) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('comprobantes')
      .getPublicUrl(fileName)

    return publicUrl
  }
}
