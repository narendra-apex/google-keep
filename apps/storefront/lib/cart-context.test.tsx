import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CartProvider, useCart, useMiniCart } from "./cart-context";
import * as ecommerceActions from "./server-actions/ecommerce";

vi.mock("./server-actions/ecommerce");

const mockCart = {
  cart_id: "cart-123",
  customer_id: "customer-123",
  items: [
    {
      product_id: "product-1",
      name: "Test Product",
      quantity: 2,
      unit_price_cents: 1000,
      line_total_cents: 2000,
    },
  ],
  subtotal_cents: 2000,
  tax_cents: 200,
  shipping_cost_cents: 500,
  discount_cents: 0,
  total_cents: 2700,
  currency: "USD",
  applied_promo_codes: [],
};

function TestComponent() {
  const cart = useCart();
  const miniCart = useMiniCart();

  return (
    <div>
      <p data-testid="item-count">{miniCart.itemCount}</p>
      <p data-testid="total">{miniCart.total}</p>
      <p data-testid="cart-id">{cart.cart?.cart_id || "no-cart"}</p>
      <button onClick={() => cart.addItem("product-1", 1)}>Add Item</button>
      <button onClick={() => cart.updateItem("product-1", 5)}>Update Item</button>
      <button onClick={() => cart.removeItem("product-1")}>Remove Item</button>
      <button onClick={() => cart.applyPromo("SAVE10")}>Apply Promo</button>
      <button onClick={() => cart.refresh()}>Refresh</button>
    </div>
  );
}

describe("CartProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide cart context to children", () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    expect(screen.getByTestId("item-count")).toBeInTheDocument();
    expect(screen.getByTestId("total")).toBeInTheDocument();
  });

  it("should add item to cart", async () => {
    (ecommerceActions.addToCart as any).mockResolvedValueOnce(mockCart);

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    const addButton = screen.getByText("Add Item");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(ecommerceActions.addToCart).toHaveBeenCalledWith({
        product_id: "product-1",
        variant_id: undefined,
        quantity: 1,
      });
    });
  });

  it("should update cart item quantity", async () => {
    (ecommerceActions.updateCartItem as any).mockResolvedValueOnce(mockCart);

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    const updateButton = screen.getByText("Update Item");
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(ecommerceActions.updateCartItem).toHaveBeenCalledWith("product-1", {
        quantity: 5,
      });
    });
  });

  it("should remove item from cart", async () => {
    (ecommerceActions.removeFromCart as any).mockResolvedValueOnce(mockCart);

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    const removeButton = screen.getByText("Remove Item");
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(ecommerceActions.removeFromCart).toHaveBeenCalledWith("product-1");
    });
  });

  it("should apply promo code", async () => {
    (ecommerceActions.applyPromoCode as any).mockResolvedValueOnce(mockCart);

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    const promoButton = screen.getByText("Apply Promo");
    fireEvent.click(promoButton);

    await waitFor(() => {
      expect(ecommerceActions.applyPromoCode).toHaveBeenCalledWith("SAVE10");
    });
  });

  it("should refresh cart", async () => {
    (ecommerceActions.getCart as any).mockResolvedValueOnce(mockCart);

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    const refreshButton = screen.getByText("Refresh");
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(ecommerceActions.getCart).toHaveBeenCalled();
    });
  });

  it("useMiniCart should return correct values", async () => {
    (ecommerceActions.getCart as any).mockResolvedValueOnce(mockCart);

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    const refreshButton = screen.getByText("Refresh");
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByTestId("item-count")).toHaveTextContent("1");
      expect(screen.getByTestId("total")).toHaveTextContent("2700");
    });
  });

  it("should handle errors in add item", async () => {
    const error = new Error("Add failed");
    (ecommerceActions.addToCart as any).mockRejectedValueOnce(error);

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    const addButton = screen.getByText("Add Item");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(ecommerceActions.addToCart).toHaveBeenCalled();
    });
  });
});
