import { supabase } from '../lib/supabase'

export interface Product {
  id: string
  nombre: string
  descripcion: string
  precio: number
  imagenes: string[]
  stock: number
  activo: boolean
  cantidades: number[]
  precios_bulk?: { cantidad: number, precio_total: number }[]
  whatsapp_numero?: string
  datos_bancarios?: string
  notas_placeholder?: string
}

export const productService = {
  async getAll(includeInactive = false) {
    let query = supabase.from('productos').select('*').order('nombre')
    
    if (!includeInactive) {
      query = query.eq('activo', true)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data as Product[]
  },

  async addProduct(product: Omit<Product, 'id'>) {
    const { data, error } = await supabase
      .from('productos')
      .insert([product])
      .select()
    
    if (error) throw error
    return data[0]
  },

  async updateProduct(id: string, updates: Partial<Product>) {
    const { data, error } = await supabase
      .from('productos')
      .update(updates)
      .eq('id', id)
      .select()
    
    if (error) throw error
    return data[0]
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  async uploadImage(file: File) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('productos')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('productos')
      .getPublicUrl(filePath)

    return publicUrl
  }
}

