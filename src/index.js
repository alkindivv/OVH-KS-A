const ovh = require("ovh");
const readline = require("readline");
const axios = require("axios");
const fs = require("fs");
const util = require("util");
const {
  sendTelegramNotification,
  formatServerMessage,
  formatErrorMessage,
  formatOrderSuccessMessage,
  formatMonitoringStatus,
  formatStartMonitoringMessage,
} = require("./notifications");
const catalog24ska01 = require("./catalog-24ska01");

const logFile = fs.createWriteStream("server-monitor.log", { flags: "a" });
console.log = function () {
  const timestamp = new Date().toISOString();
  const args = Array.from(arguments);

  // Filter log yang penting saja
  const message = util.format.apply(null, args);
  if (
    message.includes("Error") ||
    message.includes("Server tersedia") ||
    message.includes("Order successful") ||
    message.includes("Starting OVH Server Monitor")
  ) {
    // Hanya tulis ke file untuk event penting
    logFile.write(`[${timestamp}] ${message}\n`);
  }

  // Tetap tampilkan semua log di console
  process.stdout.write(`${message}\n`);
};

// Tambahkan fungsi cleanup log
function cleanupLogFile() {
  const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

  try {
    const stats = fs.statSync("server-monitor.log");
    if (stats.size > MAX_LOG_SIZE) {
      // Backup log lama
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.renameSync("server-monitor.log", `server-monitor-${timestamp}.log`);

      // Buat file log baru
      logFile.end();
      logFile = fs.createWriteStream("server-monitor.log", { flags: "a" });
    }
  } catch (error) {
    console.error("Error cleaning up log file:", error);
  }
}

// Jalankan cleanup setiap 1 jam
setInterval(cleanupLogFile, 60 * 60 * 1000);

// OVH Client untuk pembelian - Gunakan endpoint kimsufi-ca
const client = ovh({
  endpoint: process.env.OVH_ENDPOINT,
  appKey: process.env.OVH_APP_KEY,
  appSecret: process.env.OVH_APP_SECRET,
  consumerKey: process.env.OVH_CONSUMER_KEY,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});
async function checkServerAvailability() {
  try {
    const response = await client.requestPromised(
      "GET",
      "/dedicated/server/datacenter/availabilities",
      { server: "24ska01" }
    );

    console.log("Availability Response:", JSON.stringify(response, null, 2));

    const availableServers = response.filter((server) => {
      // Pastikan ini server 24ska01
      if (server.server !== "24ska01") return false;

      // Cek availability di datacenter selain SGP dan SYD
      const isAvailable = server.datacenters.some(
        (dc) =>
          dc.availability !== "unavailable" &&
          !["sgp", "syd"].includes(dc.datacenter)
      );

      return isAvailable;
    });

    if (availableServers.length > 0) {
      console.log("🎯 Server found:", availableServers[0]);
      return availableServers[0];
    } else {
      process.stdout.write("\r⏳ Checking server availability...");
      return null;
    }
  } catch (error) {
    console.error("Error checking availability:", error);
    return null;
  }
}

async function orderServer(server) {
  if (!server) {
    console.log("No server information provided.");
    return;
  }

  let cart = null;

  try {
    // Validasi dengan catalog24ska01
    if (server.server !== catalog24ska01.planCode) {
      console.log("Invalid server planCode");
      return null;
    }

    // 1. Cek availability dan pilih datacenter
    console.log("\n🔍 Checking server availability...");
    const availabilityResponse = await client.requestPromised(
      "GET",
      "/dedicated/server/datacenter/availabilities",
      { server: server.server }
    );
    console.log("Availability:", JSON.stringify(availabilityResponse, null, 2));

    // Pilih datacenter yang tersedia (prioritaskan BHS)
    const serverConfig = availabilityResponse.find(
      (s) => s.server === server.server
    );
    if (!serverConfig) {
      console.log("Server configuration not found");
      return null;
    }

    const availableDC =
      serverConfig.datacenters.find(
        (dc) => dc.availability !== "unavailable" && dc.datacenter === "bhs"
      ) ||
      serverConfig.datacenters.find((dc) => dc.availability !== "unavailable");

    if (!availableDC) {
      console.log("No available datacenter found");
      return null;
    }

    const selectedDatacenter = availableDC.datacenter;
    console.log(`Selected datacenter: ${selectedDatacenter}`);

    // 2. Create cart dengan expire time
    console.log("\n🛒 Creating cart...");
    cart = await client.requestPromised("POST", "/order/cart", {
      ovhSubsidiary: "CA",
      description: "Server Order",
      expire: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
    console.log("Cart created with ID:", cart.cartId);

    // 3. Assign cart
    console.log(`\n🔗 Assigning cart ${cart.cartId}...`);
    await client.requestPromised("POST", `/order/cart/${cart.cartId}/assign`);

    // 4. Add server dengan options dari catalog24ska01
    console.log(`\n📦 Adding server to cart ${cart.cartId}...`);
    const cartItem = await client.requestPromised(
      "POST",
      `/order/cart/${cart.cartId}/eco`,
      {
        duration: "P1M",
        planCode: catalog24ska01.planCode,
        pricingMode: "default",
        quantity: 1,
      }
    );

    // 5. Add mandatory options dari catalog24ska01
    console.log("\n⚙️ Adding options...");
    const options = [
      {
        planCode: catalog24ska01.mandatory_addons.memory,
        label: "Memory",
      },
      {
        planCode: catalog24ska01.mandatory_addons.storage,
        label: "Storage",
      },
      {
        planCode: catalog24ska01.mandatory_addons.bandwidth,
        label: "Bandwidth",
      },
    ];

    for (const option of options) {
      console.log(`Adding ${option.label} option...`);
      await client.requestPromised(
        "POST",
        `/order/cart/${cart.cartId}/eco/options`,
        {
          duration: "P1M",
          itemId: cartItem.itemId,
          planCode: option.planCode,
          pricingMode: "default",
          quantity: 1,
        }
      );
    }

    // Add configurations dari catalog24ska01
    console.log("\n⚙️ Adding required configurations...");
    const configs = [
      {
        label: "dedicated_datacenter",
        value: server.datacenters[0].datacenter,
      },
      {
        label: "region",
        value: catalog24ska01.configurations.region,
      },
      {
        label: "dedicated_os",
        value: catalog24ska01.configurations.dedicated_os,
      },
    ];

    for (const config of configs) {
      await client.requestPromised(
        "POST",
        `/order/cart/${cart.cartId}/item/${cartItem.itemId}/configuration`,
        config
      );
    }

    // 6. Validasi cart SEBELUM checkout
    console.log(`\n✔️ Validating cart ${cart.cartId}...`);
    try {
      const cartStatus = await client.requestPromised(
        "GET",
        `/order/cart/${cart.cartId}`,
        {}
      );
      console.log("Cart status:", JSON.stringify(cartStatus, null, 2));

      if (!cartStatus.items || cartStatus.items.length === 0) {
        throw new Error("Cart is empty");
      }

      if (!cartStatus.readOnly) {
        console.log("Validating cart...");
        try {
          const response = await client.requestPromised(
            "POST",
            "order/cart/" + cart.cartId + "/validate",
            {
              cartId: cart.cartId,
            }
          );
          console.log(
            "Validation response:",
            JSON.stringify(response, null, 2)
          );
        } catch (validationError) {
          console.log("Direct validation failed, proceeding with checkout...");
          const cartCheck = await client.requestPromised(
            "GET",
            `/order/cart/${cart.cartId}/checkout`,
            {}
          );
          if (cartCheck) {
            console.log("Cart is valid for checkout");
          }
        }
      }

      console.log("\n📋 Cart Summary:");
      console.log(`Cart ID: ${cart.cartId}`);
      console.log(`Server: ${server.server}`);
      console.log(`Datacenter: ${selectedDatacenter}`);
      console.log(`Memory: 64GB`);
      console.log(`Storage: 480GB`);
      console.log(`Bandwidth: 100Mbps`);

      console.log("\n⏳ Waiting for order processing...");
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // 7. Checkout
      console.log("\n💳 Processing checkout...");
      const order = await client.requestPromised(
        "POST",
        `/order/cart/${cart.cartId}/checkout`,
        {
          autoPayWithPreferredPaymentMethod: true,
          waiveRetractationPeriod: false,
        }
      );

      return order;
    } catch (error) {
      console.error("Error during checkout process:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error ordering server:", error);
    return null;
  }
}

async function startMonitoring() {
  console.log("🤖 Starting OVH Server Monitor...");
  let attempts = 0;
  let lastStatusTime = Date.now();
  const STATUS_INTERVAL = 6 * 60 * 60 * 1000; // 6 jam
  const MAX_ORDERS = 2;
  let orderCount = 0;

  // Kirim notifikasi bot mulai
  await sendTelegramNotification(formatStartMonitoringMessage(MAX_ORDERS));

  while (true) {
    try {
      attempts++;
      const server = await checkServerAvailability();
      const currentTime = Date.now();

      // Kirim status monitoring setiap 6 jam
      if (currentTime - lastStatusTime >= STATUS_INTERVAL) {
        await sendTelegramNotification(
          formatMonitoringStatus(
            attempts,
            new Date(currentTime + STATUS_INTERVAL).toLocaleString()
          )
        );
        lastStatusTime = currentTime;
      }

      if (server) {
        // Server tersedia - kirim notifikasi detail
        await sendTelegramNotification(
          formatServerMessage(
            server.server,
            server.datacenters[0].datacenter,
            "$14.40/month"
          )
        );

        console.log("\n🔔 Server tersedia! Memulai proses pemesanan...");
        const order = await orderServer(server);

        if (order && order.url) {
          await sendTelegramNotification(formatOrderSuccessMessage(order));
          orderCount++;

          // Cek apakah sudah mencapai batas maksimum order
          if (orderCount >= MAX_ORDERS) {
            await sendTelegramNotification(
              `🛑 Bot berhenti: Sudah mencapai batas ${MAX_ORDERS} server`
            );
            break;
          }

          // Hapus delay dan langsung lanjut monitor
          console.log("\n🔄 Melanjutkan monitoring untuk server berikutnya...");
        }
      } else {
        process.stdout.write(
          "\r⏳ Checking server availability... Attempt: " + attempts
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      await sendTelegramNotification(formatErrorMessage(error));
      console.error("\n❌ Error dalam monitoring:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
  // Kirim notifikasi error
  sendTelegramNotification(`❌ Error: ${error.message}`);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  // Kirim notifikasi error
  sendTelegramNotification(`❌ Fatal Error: ${error.message}`);
  process.exit(1);
});

startMonitoring().catch(console.error);
