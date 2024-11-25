const axios = require("axios");
require("dotenv").config();

async function sendTelegramNotification(message) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("Telegram credentials not found in .env");
    return;
  }

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }
    );

    if (response.data.ok) {
      console.log("Telegram notification sent successfully");
    } else {
      console.error("Failed to send Telegram notification:", response.data);
    }
  } catch (error) {
    console.error("Error sending Telegram notification:", error.message);
  }
}

// Format pesan untuk server tersedia
function formatServerMessage(server, datacenter, price) {
  return `
🚨 <b>SERVER TERSEDIA!</b> 🚨

📊 <b>Detail Server:</b>
━━━━━━━━━━━━━━━━
🖥️ Model: <code>${server}</code>
📍 Datacenter: <code>${datacenter}</code>
💰 Harga: <code>${price}</code>

🔄 <b>Status:</b> Memulai proses pemesanan otomatis...

⏰ Waktu Deteksi: ${new Date().toLocaleString()}
`;
}

// Format pesan untuk order berhasil
function formatOrderSuccessMessage(order) {
  return `
✅ <b>ORDER BERHASIL!</b> ✅

🛒 <b>Detail Pesanan:</b>
━━━━━━━━━━━━━━━━
📋 Order ID: <code>${order.orderId}</code>
💳 Total: <code>${order.prices.withTax.text}</code>

🔗 <b>Link Pembayaran:</b>
${order.url}

⚠️ <b>Penting:</b>
• Link pembayaran hanya berlaku untuk waktu terbatas
• Segera selesaikan pembayaran untuk mengamankan server
• Setelah pembayaran, setup akan dimulai otomatis

⏰ Waktu Order: ${new Date().toLocaleString()}
`;
}

// Format pesan untuk error
function formatErrorMessage(error) {
  return `
❌ <b>ERROR TERDETEKSI!</b>

🔍 <b>Detail Error:</b>
━━━━━━━━━━━━━━━━
Type: ${error.name || "Unknown Error"}
Message: <code>${error.message}</code>

📝 <b>Stack Trace:</b>
<code>${error.stack ? error.stack.slice(0, 300) + "..." : "No stack trace available"}</code>

⏰ Waktu: ${new Date().toLocaleString()}

🔄 Monitor akan mencoba kembali dalam 30 detik...
`;
}

// Format pesan untuk status monitoring
function formatMonitoringStatus(attempts, nextCheck) {
  return `
🤖 <b>STATUS MONITORING</b>

📊 <b>Informasi:</b>
━━━━━━━━━━━━━━━━
🔍 Total Pengecekan: ${attempts}
⏱️ Pengecekan Berikutnya: ${nextCheck}
🟢 Status: Active

📌 <b>Server Target:</b>
• Model: KS-A
• Datacenter: All
• Budget: $14.40/bulan

⏰ Update Terakhir: ${new Date().toLocaleString()}
`;
}

// Format pesan untuk start monitoring
function formatStartMonitoringMessage(maxOrders) {
  return `
🟢 <b>BOT MONITOR STARTED</b>

📊 <b>Konfigurasi:</b>
━━━━━━━━━━━━━━━━
🎯 Target: <code>${maxOrders} server</code>
🖥️ Model: <code>KS-A</code>
💰 Budget: <code>$11.20/bulan</code>
⏱️ Interval Status: <code>6 jam</code>

⏰ Waktu Mulai: ${new Date().toLocaleString()}

🤖 Bot sedang aktif memonitor ketersediaan server...
`;
}

module.exports = {
  sendTelegramNotification,
  formatServerMessage,
  formatOrderSuccessMessage,
  formatErrorMessage,
  formatMonitoringStatus,
  formatStartMonitoringMessage,
};
