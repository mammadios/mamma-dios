// Server-side only - Twilio SMS helper

export async function sendSMS(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !from) {
    console.warn('Twilio not configured - SMS not sent')
    return { success: false, error: 'Twilio not configured' }
  }

  // Format phone number
  let formattedPhone = to.replace(/\D/g, '')
  if (formattedPhone.length === 10) formattedPhone = '1' + formattedPhone
  if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone

  try {
    const twilio = require('twilio')(accountSid, authToken)
    const message = await twilio.messages.create({
      body,
      from,
      to: formattedPhone,
    })
    return { success: true, sid: message.sid }
  } catch (error) {
    console.error('Twilio error:', error)
    return { success: false, error: error.message }
  }
}

export function buildOrderStartedMessage(customerName, orderNumber) {
  return `Hi ${customerName}! 🍕 Mamma Dio's has started on your order #${orderNumber}. We'll text you when it's ready for pickup!`
}

export function buildOrderReadyMessage(customerName, orderNumber) {
  return `Hey ${customerName}! 🔔 Your order #${orderNumber} from Mamma Dio's is READY for pickup! Come grab it while it's hot! 🍕`
}
