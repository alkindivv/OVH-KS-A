async function cleanupExpiredCarts() {
  try {
    const carts = await client.requestPromised("GET", "/order/cart", {});
    for (const cartId of carts) {
      const cart = await client.requestPromised(
        "GET",
        `/order/cart/${cartId}`,
        {}
      );
      if (new Date(cart.expire) < new Date()) {
        console.log(`Cleaning up expired cart: ${cartId}`);
        await client.requestPromised("DELETE", `/order/cart/${cartId}`);
      }
    }
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}
