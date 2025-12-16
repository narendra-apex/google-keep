# Storefront Architecture & Brand Setup Guide

## Overview

The storefront is a multi-brand Next.js 16 application built with the App Router that serves as the customer-facing e-commerce experience for the Unified Commerce OS. Each brand gets its own subdomain or route segment (`[brand]`) with dynamically loaded metadata, theming, and configuration.

## Architecture

### Directory Structure

```
apps/storefront/
├── app/
│   ├── layout.tsx                     # Root layout (HTML structure)
│   ├── globals.css                    # Global styles with CSS variables
│   └── (store)/
│       ├── layout.tsx                 # Store layout (BrandProvider, CartProvider)
│       └── [brand]/
│           ├── page.tsx               # Product listing with SWR
│           ├── about/page.tsx         # About page
│           ├── products/
│           │   └── [productId]/
│           │       └── page.tsx       # Product detail page
│           ├── cart/page.tsx          # Cart summary
│           └── checkout/page.tsx      # Multi-step checkout
├── components/
│   ├── header.tsx                     # Navigation header (brand-aware)
│   ├── footer.tsx                     # Footer with brand info
│   └── product-card.tsx               # Reusable product card
├── lib/
│   ├── fetcher.ts                     # SWR fetcher with header injection
│   ├── utils.ts                       # Helper utilities (formatting, etc.)
│   ├── brand-provider.tsx             # Client-side theming provider
│   ├── cart-context.tsx               # CartProvider + hooks
│   └── server-actions/
│       ├── brands.ts                  # Server actions for brand metadata
│       └── ecommerce.ts               # Server actions for cart/checkout
├── middleware.ts                      # Tenant/brand context injection
├── vitest.config.ts                   # Test configuration
└── package.json                       # Dependencies
```

### Key Components

#### 1. **BrandProvider** (`lib/brand-provider.tsx`)
- Client component that applies CSS variables based on brand metadata
- Sets theme colors, typography, spacing dynamically
- Stores metadata in localStorage for client components

#### 2. **CartProvider** (`lib/cart-context.tsx`)
- React Context for global cart state
- Provides `useCart()` hook for components
- Syncs with server actions (`addToCart`, `updateCartItem`, etc.)
- Maintains optimistic UI updates

#### 3. **SWR Data Layer** (`lib/fetcher.ts`)
- Fetcher function that automatically injects `x-tenant-id` and `x-brand-id` headers
- Used by `useSWR` on product listing and review pages
- Handles client-side caching and revalidation

#### 4. **Server Actions** (`lib/server-actions/`)
- `brands.ts`: Fetch brand metadata (cached for 1 hour on server)
- `ecommerce.ts`: Cart mutations (add, update, remove, checkout) called from client

#### 5. **Middleware** (`middleware.ts`)
- Injects tenant/brand context from cookies into request headers
- Forwards session cookies for authenticated requests

### Data Flow

#### Product Listing
```
[brand]/page.tsx
  → useSWR("GET /products?...")
    → fetcher() [injects headers]
    → API returns paginated products
  → User selects product
  → CartProvider.addItem()
    → Server Action: addToCart()
    → API: POST /cart/items
```

#### Brand Metadata Loading
```
(store)/layout.tsx (Server Component)
  → getBrandMetadata(brandId)
    → API: GET /brands/{brandId}
  → Render with <BrandProvider metadata={...}>
    → <style> sets CSS variables
    → Children hydrate with theme
```

#### Checkout Flow
```
[brand]/checkout/page.tsx
  → User fills: shipping, payment, review
  → handleCheckout()
    → Server Action: checkoutCart(address, payment_method)
    → API: POST /cart/checkout
    → Returns order_id + payment_url
    → Show confirmation
```

## API Integration

### Required Endpoints

**Foundation API**
- `GET /brands/{brandId}` - Fetch brand metadata with theme, localization, channels config

**Commerce/Ecommerce API**
- `GET /products?limit=20&offset=0&status=active` - List products (paginated)
- `GET /products/{productId}` - Product detail with variants
- `GET /products/{productId}/reviews` - Product reviews

**Ecommerce API** (Cart & Checkout)
- `POST /cart/items` - Add to cart
- `PATCH /cart/items/{productId}` - Update quantity
- `DELETE /cart/items/{productId}` - Remove from cart
- `POST /cart/apply-promo` - Apply promo code
- `GET /cart` - Get current cart
- `POST /cart/checkout` - Submit order
- `GET /channels` - List active channels
- `POST /products/{productId}/reviews` - Submit review

### Headers

All requests from client must include:
- `x-tenant-id` (from cookies or middleware) - Multi-tenant isolation
- `x-brand-id` (from URL segment or cookies) - Brand context
- `cookie: session_id=...` (optional) - Customer authentication for logged-in users

The middleware automatically injects these headers from cookies.

## Theming & CSS Variables

Brand metadata includes a `theme` section:

```json
{
  "theme": {
    "primary_theme": {
      "colors": {
        "primary": "#0066CC",
        "secondary": "#FF9900",
        "accent": "#00AA44",
        "background": "#FFFFFF",
        "text": "#333333",
        "success": "#00AA44",
        "warning": "#FFAA00",
        "error": "#CC0000"
      },
      "typography": {
        "heading_font": "Inter",
        "body_font": "Inter",
        "heading_size_px": 32,
        "body_size_px": 14,
        "line_height": 1.5
      },
      "spacing": {
        "base_unit_px": 8,
        "border_radius_px": 4
      },
      "branding": {
        "logo_url": "https://cdn.example.com/logo.png",
        "favicon_url": "https://cdn.example.com/favicon.ico"
      },
      "storefront": {
        "logo_position": "top_left",
        "header_style": "sticky",
        "product_image_display": "carousel",
        "show_reviews": true
      }
    }
  }
}
```

CSS variables are set in `globals.css` and updated by `BrandProvider`:

```css
:root {
  --color-primary: var(--color-primary, #0066CC);
  --color-secondary: var(--color-secondary, #FF9900);
  --font-heading: var(--font-heading, "Inter");
  --spacing-unit: var(--spacing-unit, 8px);
  --border-radius: var(--border-radius, 4px);
}
```

Tailwind config uses these variables for dynamic styling:

```ts
colors: {
  primary: "var(--color-primary)",
  secondary: "var(--color-secondary)",
  // ...
}
```

## Setting Up a New Brand

### Step 1: Create Brand in Admin

Use the Admin Portal or API to create a brand:

```bash
curl -X POST http://localhost:3000/v1/brands \
  -H "x-tenant-id: tenant-123" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Store",
    "legal_name": "Acme Inc.",
    "settings": {
      "schema_version": "1.0.0",
      "theme": {...},
      "localization": {...}
    }
  }'
```

Response includes `brand_id`.

### Step 2: Configure Theme & Metadata

Update brand settings with:
- Colors (primary, secondary, accent, etc.)
- Fonts and typography
- Logo URL, favicon, banners
- Supported languages, currencies
- Feature flags (reviews enabled, etc.)

### Step 3: Create Channels (Optional)

Define sales channels for the brand:

```bash
curl -X POST http://localhost:3000/v1/channels \
  -H "x-tenant-id: tenant-123" \
  -H "x-brand-id: brand-id" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Storefront",
    "type": "storefront",
    "settings": {
      "url": "https://store.example.com",
      "sync_inventory": true,
      "sync_orders": true
    }
  }'
```

### Step 4: Access Storefront

Navigate to storefront with brand in URL:

```
http://localhost:3001/brand-id
http://store.example.com/brand-id (production)
```

## Multi-Brand URL Strategies

### Path-Based (Default)
```
https://store.example.com/brand-id/products
https://store.example.com/acme/cart
```

Each brand is a route segment. Easy for testing, works with any domain.

### Subdomain-Based (Optional)
```
https://acme.store.example.com/products
https://nike.store.example.com/cart
```

Requires DNS wildcard (`*.store.example.com`) and middleware to extract subdomain:

```ts
// middleware.ts
const hostname = request.headers.get("host") || "";
const subdomain = hostname.split(".")[0]; // "acme" or "nike"
```

## Client-Side Usage Examples

### Product Listing with SWR

```tsx
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

function ProductList({ brandId }) {
  const { data, error, isLoading } = useSWR(
    "/api/products?limit=20",
    (url) => fetcher(url, { brandId }),
    { revalidateOnFocus: false }
  );

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {data?.data.map(p => <ProductCard key={p.product_id} product={p} />)}
    </div>
  );
}
```

### Adding to Cart

```tsx
import { useCart } from "@/lib/cart-context";

function AddToCartButton({ productId }) {
  const { addItem, isLoading, error } = useCart();

  const handleClick = async () => {
    try {
      await addItem(productId, 1);
      // Show success message
    } catch (err) {
      // Show error message
    }
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? "Adding..." : "Add to Cart"}
    </button>
  );
}
```

### Mini Cart Hook

```tsx
import { useMiniCart } from "@/lib/cart-context";

function MiniCart() {
  const { itemCount, total, currency } = useMiniCart();

  return (
    <div>
      Items: {itemCount}
      Total: {total / 100} {currency}
    </div>
  );
}
```

## Testing

### Unit Tests

Tests cover:
1. **SWR Fetcher** - Headers injection, error handling
2. **CartProvider** - Add/update/remove items, apply promo, error states
3. **Server Actions** - Serialization, API error handling

Run tests:
```bash
cd apps/storefront
bun test
```

### Integration Tests (Recommended)

Test full flows:
1. Browse products → add to cart → checkout
2. Brand switching → theme updates
3. Filter & sort → pagination

## Performance Optimization

### Caching Strategy

- **Brand Metadata**: Cached on server for 1 hour (revalidate)
- **Products**: SWR with revalidateOnFocus=false (client-side cache)
- **Images**: Use Next.js Image optimization (automatic resizing)

### Code Splitting

- Cart/checkout pages loaded on-demand (Next.js automatic)
- SWR library code split per page
- Heavy libraries (chart, editor) lazy-loaded

### SEO

Each brand page has:
- Dynamic `<title>` and `<meta name="description">`
- Open Graph tags for social sharing
- Structured data for products (schema.org)

## Environment Variables

Create `.env.local` in `apps/storefront/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
```

Or for production:

```env
NEXT_PUBLIC_API_URL=https://api.example.com/v1
```

## Troubleshooting

### Brand Metadata Not Loading
- Check API is running and `/brands/{brandId}` returns data
- Verify `x-tenant-id` header is being sent
- Check browser console for fetch errors

### Theme Not Applying
- Verify BrandProvider is wrapping the layout
- Check CSS variables are set in document.documentElement.style
- Clear browser cache and localStorage

### Cart State Not Syncing
- Ensure CartProvider wraps all cart-related pages
- Check server actions are being called (browser DevTools > Network)
- Verify session cookie is being sent for authenticated users

### Headers Not Injected
- Check middleware.ts is configured correctly
- Verify cookies are being set (DevTools > Application > Cookies)
- Check request headers in Network tab

## Future Enhancements

1. **Brand Switcher Component** - Dropdown to switch between brands, save selection to cookie
2. **Localization** - i18n integration to support multiple languages per brand
3. **Reviews & Ratings** - Full review submission and display (currently read-only)
4. **Wishlist** - Save products for later
5. **Order History** - Authenticated customers can view past orders
6. **Analytics** - Track pageviews, conversions, revenue per brand
7. **Newsletter Signup** - Integration with email service
8. **Search** - Full-text search using Meilisearch (if configured)
