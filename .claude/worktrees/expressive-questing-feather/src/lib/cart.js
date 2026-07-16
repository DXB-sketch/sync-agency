// Cart lives in localStorage until the member pays. Each line is one
// order_item: a product + quantity + its OWN shipping address (each item may
// ship to a different Depop buyer).
const KEY = "sync_cart_v1";

export const EMPTY_ADDRESS = {
  ship_name: "",
  ship_address1: "",
  ship_address2: "",
  ship_city: "",
  ship_region: "",
  ship_postcode: "",
  ship_country: "",
};

export function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function clearCart() {
  localStorage.removeItem(KEY);
}

export function addToCart(product) {
  const items = loadCart();
  items.push({
    line_id: crypto.randomUUID(),
    product_id: product.id,
    name: product.name,
    image_url: product.image_url,
    unit_price: Number(product.price),
    quantity: 1,
    address: { ...EMPTY_ADDRESS },
  });
  saveCart(items);
  window.dispatchEvent(new CustomEvent("sync:cart-add", { detail: { product } }));
  return items;
}

export function cartTotal(items) {
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
}
