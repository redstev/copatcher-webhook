// /api/webhook.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Vercel skal have raw body for Stripe-signatur
export const config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Læs raw body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Verificér Stripe-signatur
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Håndter Stripe event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;
    const customerName = session.customer_details.name || 'Friend';
    const amountPaid = (session.amount_total / 100).toFixed(2);
    const currency = session.currency.toUpperCase();
    const paymentDate = new Date(session.created * 1000).toLocaleString('da-DK');

    try {
      await sendDownloadEmail(customerEmail, customerName);
      await sendSaleNotification(
        customerEmail,
        customerName,
        amountPaid,
        currency,
        paymentDate
      );

      console.log('✅ Emails sent successfully');
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      return res.status(500).json({ error: 'Email sending failed' });
    }
  }

  res.status(200).json({ received: true });
};

// 📩 Kundemail med download
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
      <p>- Copat 🤖</p>
    `
  };

  await sgMail.send(msg);
}

// 📩 Notifikation til dig
async function sendSaleNotification(customerEmail, customerName, amount, currency, date) {
  const msg = {
    to: '279sdh@gmail.com',
    from: 'copat@copatcher.com',
    subject: '🎉 CHA-CHING! New Copatcher Sale! 💰',
    html: `
      <h2>💰 Sale Details:</h2>
      <p><strong>Customer:</strong> ${customerName}</p>
      <p><strong>Email:</strong> ${customerEmail}</p>
      <p><strong>Amount:</strong> ${amount} ${currency}</p>
      <p><strong>Date:</strong> ${date}</p>
    `
  };

  await sgMail.send(msg);
}
