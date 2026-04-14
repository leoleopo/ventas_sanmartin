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

  async deleteAllOrders() {
    const { error } = await supabase
      .from('pedidos')
      .delete()
      .gte('created_at', '1970-01-01') // Standard way to target all rows in Supabase
    
    if (error) throw error
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
