const fs = require('fs');
let text = fs.readFileSync('D:/PRC-Backend/src/config/swagger.ts', 'utf-8');

text = text.replace(/"\/purchase-orders[^]*?(?="\/(?:admin\/users|users|logistics|auth|quotes|payments))/g, '');
text = text.replace(/"\/admin\/purchase-orders[^]*?(?="\/(?:admin\/users|users|logistics|auth|quotes|payments))/g, '');

fs.writeFileSync('D:/PRC-Backend/src/config/swagger.ts', text);
