import { createServerSupabase } from '../../lib/supabase'

export default async function handler(req, res) {
  const supabase = createServerSupabase()

  if (req.method === 'GET') {
    const { status, limit = 100 } = req.query
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.in('status', ['pending', 'in_process', 'ready'])
      } else {
        query = query.eq('status', status)
      }
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { customer_name, phone_number, order_items, special_requests, total, returning_customer } = req.body

    if (!customer_name || !phone_number || !order_items?.length) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if returning customer
    let isReturning = returning_customer || false
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, visit_count')
      .eq('phone_number', phone_number.replace(/\D/g, ''))
      .single()

    if (existingCustomer) {
      isReturning = true
      // Update visit count
      await supabase
        .from('customers')
        .update({ visit_count: existingCustomer.visit_count + 1, last_visit: new Date().toISOString(), customer_name })
        .eq('id', existingCustomer.id)
    } else {
      // Insert new customer
      await supabase
        .from('customers')
        .insert({ phone_number: phone_number.replace(/\D/g, ''), customer_name })
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name,
        phone_number,
        order_items,
        special_requests: special_requests || '',
        total: parseFloat(total) || 0,
        returning_customer: isReturning,
        status: 'pending',
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
