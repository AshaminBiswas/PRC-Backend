const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  family: 4, // Force IPv4
  auth: {
    user: 'ashaminbiswas1@gmail.com',
    pass: 'bdueccvvaldzzaln'
  }
});

transporter.sendMail({
  from: '"PRC Hardware" <ashaminbiswas1@gmail.com>',
  to: 'ashaminbiswas1@gmail.com',
  subject: 'Test Family 4',
  text: 'Hello world'
}).then(info => {
  console.log('Success:', info.messageId);
}).catch(err => {
  console.error('SMTP Error:', err.message);
});
