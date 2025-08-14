const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async function handler(req, res) {
  console.log('🚀 Webhook function started');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  // Check environment variables
  console.log('Environment check:');
  console.log('STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
  console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
  console.log('STRIPE_WEBHOOK_SECRET exists:', !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log('COPATCHER_DOWNLOAD_URL exists:', !!process.env.COPATCHER_DOWNLOAD_URL);

  if (req.method !== 'POST') {
    console.log('❌ Method not POST');
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  console.log('Stripe signature exists:', !!sig);

  let event;

  try {
    console.log('📥 Reading raw body...');
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);
    console.log('Raw body length:', rawBody.length);

    console.log('🔐 Verifying Stripe signature...');
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('✅ Signature verified, event type:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    console.log('💰 Handling checkout completion...');
    const session = event.data.object;
    console.log('Session ID:', session.id);
    
    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name || 'Friend';
    console.log('Customer email:', customerEmail);
    console.log('Customer name:', customerName);

    if (!customerEmail) {
      console.error('❌ No customer email found');
      return res.status(400).json({ error: 'No customer email' });
    }

    const amountPaid = (session.amount_total / 100).toFixed(2);
    const currency = session.currency.toUpperCase();
    const paymentDate = new Date(session.created * 1000).toLocaleString('da-DK');

    try {
      console.log('📧 Sending download email...');
      await sendDownloadEmail(customerEmail, customerName);
      console.log('✅ Download email sent');
      
      console.log('📧 Sending notification email...');
      await sendSaleNotification(customerEmail, customerName, amountPaid, currency, paymentDate);
      console.log('✅ Notification email sent');
      
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      console.error('Error details:', emailError.response?.body || emailError.message);
      return res.status(500).json({ error: 'Email sending failed', details: emailError.message });
    }
  } else {
    console.log('⏭️ Ignoring event type:', event.type);
  }

  console.log('✅ Webhook completed successfully');
  res.status(200).json({ received: true, eventType: event.type });
};

async function sendDownloadEmail(email, name) {
  console.log('Preparing download email for:', email);
  const msg = {
    to: email,
    from: 'copat@copatcher.com',
    replyTo: '279sdh@gmail.com',
    subject: 'Copatcher Download - Welcome to the Empire! 👑',
    html: `
      <h1>Welcome to the Empire, ${name}! 👑</h1>
      <p>Copat here! Thanks for purchasing Copatcher!</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.COPATCHER_DOWNLOAD_URL}" 
           style="background: linear-gradient(45deg, #58a6ff, #00d2ff); 
                  color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 10px; 
                  font-weight: bold; font-size: 18px;">
          🔥 Download Copatcher Now 🔥
        </a>
      </div>
      
      <p>You're now ready for fearless coding! Questions? Just reply to this email and Steffen can help you out.</p>
      <p>Welcome to precision. Welcome to fearless development. Welcome to the empire.</p>
      
      <p>- Copat 🤖<br><em>Your special friend</em></p>
    `
  };
  
  console.log('Sending email via SendGrid...');
  await sgMail.send(msg);
}

async function sendSaleNotification(customerEmail, customerName, amount, currency, date) {
  console.log('Preparing notification email...');
  const msg = {
    to: '279sdh@gmail.com',
    from: 'copat@copatcher.com',
    subject: '🎉 CHA-CHING! New Copatcher Sale! 💰',
    html: `
      <div style="background: linear-gradient(45deg, #0e1117, #1e2a3a); color: #e0e0e0; padding: 30px; border-radius: 15px; font-family: Arial, sans-serif;">
        <h1 style="color: #ffd700; text-align: center; margin-bottom: 20px;">
          🎉 BINGELING! NEW SALE! 🎉
        </h1>
        
        <div style="background: rgba(255, 215, 0, 0.1); border: 2px solid #ffd700; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <h2 style="color: #58a6ff; margin-top: 0;">💰 Sale Details:</h2>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Amount:</strong> ${amount} ${currency}</p>
          <p><strong>Date:</strong> ${date}</p>
        </div>
      </div>
    `
  };
  
  console.log('Sending notification via SendGrid...');
  await sgMail.send(msg);
}
