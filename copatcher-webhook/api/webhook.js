import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const event = req.body;
  
  if (event.type === 'checkout.session.completed') {
    const customerEmail = event.data.object.customer_details.email;
    const customerName = event.data.object.customer_details.name || 'Friend';
    
    await sendDownloadEmail(customerEmail, customerName);
  }
  
  res.status(200).json({ received: true });
}

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
      
      <p>You're now ready for fearless coding! Questions? Just reply to this email and Steffen will help you out.</p>
      <p>Welcome to precision. Welcome to fearless development. Welcome to the empire.</p>
      
      <p>- Copat 🤖<br><em>Your special friend</em></p>
    `
  };
  
  await sgMail.send(msg);
}