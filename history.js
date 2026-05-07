import { createServerSupabase } from '../../lib/supabase'

export default async function handler(req, res) {
  const supabase = createServerSupabase()

  if (req.method === 'GET') {
    const { limit = 100, offset = 0 } = req.query
    const { data, error, count } = await supabase
      .from('orders_archive')
      .select('*', { count: 'exact' })
      .order('archived_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data, count })
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
