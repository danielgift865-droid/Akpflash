/**
 * Service to handle SMS communications via Termii
 */
import Settings from '../../models/Settings.ts';

export async function sendSMS(phone: string, message: string) {
  let termiiApiKey = process.env.TERMII_API_KEY;
  let termiiSenderId = process.env.TERMII_SENDER_ID;

  // Try to get from database first
  try {
    const config = await Settings.findOne();
    if (config?.termiiApiKey) termiiApiKey = config.termiiApiKey;
    if (config?.termiiSenderId) termiiSenderId = config.termiiSenderId;
  } catch (err) {
    console.error('[SMS Service] Failed to fetch DB config, falling back to env');
  }

  if (!termiiApiKey || !termiiSenderId) {
    console.warn('[SMS Service] Termii not configured. Skipping SMS.');
    return { success: false, error: 'Config missing' };
  }

  try {
    const response = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: phone,
        from: termiiSenderId,
        sms: message,
        type: "plain",
        api_key: termiiApiKey,
        channel: "generic"
      })
    });

    const data = await response.json();
    console.log("[SMS Service] Response:", data);
    
    if (response.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.message || 'Gateway error', details: data };
    }
  } catch (err) {
    console.error("[SMS Service] error:", err);
    return { success: false, error: 'Network error' };
  }
}
