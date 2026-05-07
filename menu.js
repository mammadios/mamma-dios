import { createServerSupabase } from '../../lib/supabase'

export default async function handler(req, res) {
  const supabase = createServerSupabase()

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { name, price, category, available, sort_order } = req.body
    if (!name || price === undefined) return res.status(400).json({ error: 'Name and price required' })

    const { data, error } = await supabase
      .from('menu_items')
      .insert({ name, price: parseFloat(price), category: category || 'pizza', available: available !== false, sort_order: sort_order || 99 })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
