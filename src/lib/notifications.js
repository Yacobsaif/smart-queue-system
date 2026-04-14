export const triggerNotification = async (payload) => {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  
  // Return early if there's no webhook URL configured yet.
  if (!webhookUrl || webhookUrl === 'ADD_YOUR_WEBHOOK_URL_HERE') {
    console.warn('Webhook URL not configured, skipping notification:', payload);
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        console.error('Failed to trigger notification, status:', response.status);
    } else {
        console.log('Notification triggered successfully');
    }
  } catch (err) {
    console.error('Exception when triggering notification:', err);
  }
};
