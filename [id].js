import { createServerSupabase } from '../../../lib/supabase'
import { sendSMS, buildOrderStartedMessage, buildOrderReadyMessage } from '../../../lib/twilio'

export default async function handler(req, res) {
  const supabase = createServerSupabase()
  const { id } = req.query

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single()
    if (error) return res.status(404).json({ error: 'Order not found' })
    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    const updates = req.body

    // Fetch current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !order) return res.status(404).json({ error: 'Order not found' })

    // Handle status transitions
    if (updates.status === 'in_process' && order.status === 'pending') {
      updates.in_process = true
      updates.time_started = new Date().toISOString()

      // Send SMS if not already sent
      if (!order.sms_sent_start) {
        const smsResult = await sendSMS(
          order.phone_number,
          buildOrderStartedMessage(order.customer_name, order.order_number)
        )
        if (smsResult.success) updates.sms_sent_start = true
      }
    }

    if (updates.status === 'ready' && order.status === 'in_process') {
      updates.ready_for_pickup = true
      updates.time_ready = new Date().toISOString()

      // Calculate total time
      if (order.time_started) {
        const started = new Date(order.time_started)
        const ready = new Date(updates.time_ready)
        updates.total_time_minutes = Math.round((ready - started) / 60000)
      }

      // Send ready SMS
      if (!order.sms_sent_ready) {
        const smsResult = await sendSMS(
          order.phone_number,
          buildOrderReadyMessage(order.customer_name, order.order_number)
        )
        if (smsResult.success) updates.sms_sent_ready = true
      }
    }

    if (updates.status === 'completed') {
      // Archive the order
      const archiveData = {
        ...order,
        ...updates,
        archived_at: new Date().toISOString(),
      }
      delete archiveData.updated_at

      await supabase.from('orders_archive').insert(archiveData)

      // Delete from active orders
      const { error: deleteError } = await supabase.from('orders').delete().eq('id', id)
      if (deleteError) return res.status(500).json({ error: deleteError.message })
      return res.status(200).json({ archived: true })
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single()
    if (order) {
      await supabase.from('orders_archive').insert({ ...order, archived_at: new Date().toISOString() })
    }
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ deleted: true })
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
