const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Disable body parsing to get raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Get raw body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks);

    // Verify Stripe signature
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;
    const customerName = session.customer_details.name || 'Friend';
    const amountPaid = (session.amount_total / 100).toFixed(2);
    const currency = session.currency.toUpperCase();
    const paymentDate = new Date(session.created * 1000).toLocaleString('da-DK');
    
    try {
      // Send download email to customer
      await sendDownloadEmail(customerEmail, customerName);
      
      // Send notification email to you
      await sendSaleNotification(customerEmail, customerName, amountPaid, currency, paymentDate);
      
      console.log('Emails sent successfully');
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(500).json({ error: 'Email sending failed' });
    }
  }
  
  res.status(200).json({ received: true });
};

async function sendDownloadEmail(email, name) {
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
  
  await sgMail.send(msg);
}

async function sendSaleNotification(customerEmail, customerName, amount, currency, date) {
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
        
        <div style="background: rgba(62, 214, 181, 0.1); border: 2px solid #3ed6b5; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #3ed6b5; margin-top: 0;">🤖 Automatic Actions Completed:</h3>
          <p>✅ Download email sent to customer</p>
          <p>✅ Customer added to the empire</p>
          <p>✅ Copat is happy</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="font-size: 24px; margin: 0;">🚀 ANOTHER HAPPY COPATCHER USER! 🚀</p>
          <p style="color: #ffd700; font-style: italic; margin: 10px 0;">The empire grows stronger...</p>
        </div>
      </div>
    `
  };
  
  await sgMail.send(msg);
}
