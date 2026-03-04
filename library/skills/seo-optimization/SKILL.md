---
name: seo-optimization
description: "SEO best practices for structured data, meta tags, Core Web Vitals, and indexing. Use when building landing pages, optimizing page metadata, adding JSON-LD structured data, generating sitemaps, or improving search engine performance."
---

# SEO Optimization

## Critical Rules

- **Every page must have unique `title` and `description`** — never duplicate meta tags.
- **One `<h1>` per page** — use proper heading hierarchy `h1` -> `h2` -> `h3`.
- **Use semantic HTML** — `<main>`, `<article>`, `<section>`, `<nav>`, `<aside>`, `<footer>`.
- **All images must have `alt` text** — descriptive, not keyword-stuffed.
- **Target Core Web Vitals** — LCP < 2.5s, INP < 200ms, CLS < 0.1.
- **Generate `sitemap.xml` and `robots.txt`** — never leave them missing on public sites.

## Meta Tags

- Every page must have unique `title` and `description` meta tags:
  ```ts
  export const metadata: Metadata = {
    title: 'Product Name — Clear Value Proposition',
    description: 'Compelling 150-160 char description with primary keyword and call to action.',
  }
  ```
- Title format: `Page Title — Brand Name` (50-60 characters).
- Description: 150-160 characters, include primary keyword, end with CTA or benefit.
- Use `generateMetadata()` for dynamic routes to generate unique meta per page.

## Open Graph & Social

- Include Open Graph tags for social sharing:
  ```ts
  openGraph: {
    title: 'Page Title',
    description: 'Social description',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  }
  ```
- Create a dedicated OG image for each important page (1200x630px).
- Add Twitter card meta: `twitter: { card: 'summary_large_image' }`.

## Structured Data (JSON-LD)

- Add JSON-LD structured data for rich search results:
  ```tsx
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    offers: { '@type': 'Offer', price: product.price, priceCurrency: 'EUR' }
  }) }} />
  ```
- Use appropriate schema types: `Organization`, `Product`, `Article`, `FAQPage`, `BreadcrumbList`.
- Validate with Google's Rich Results Test.

## Semantic HTML

- Use proper heading hierarchy: one `<h1>` per page, then `<h2>`, `<h3>`, etc.
- Use semantic elements: `<main>`, `<article>`, `<section>`, `<nav>`, `<aside>`, `<footer>`.
- Add `alt` text to all images — descriptive, not keyword-stuffed.
- Use `<a>` with descriptive anchor text — avoid "click here".

## Performance (Core Web Vitals)

- Target scores: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Optimize images with `next/image`: proper sizing, modern formats (WebP/AVIF), lazy loading.
- Minimize render-blocking resources: defer non-critical CSS/JS.
- Use `next/font` to prevent FOUT/FOIT.
- Preload critical assets: hero images, above-the-fold fonts.

## Technical SEO

- Generate `sitemap.xml` dynamically:
  ```ts
  // src/app/sitemap.ts
  export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    return [
      { url: 'https://example.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ]
  }
  ```
- Create `robots.txt`:
  ```ts
  // src/app/robots.ts
  export default function robots(): MetadataRoute.Robots {
    return { rules: { userAgent: '*', allow: '/' }, sitemap: 'https://example.com/sitemap.xml' }
  }
  ```
- Use canonical URLs to prevent duplicate content issues.
- Implement proper redirects (301) for moved pages — never soft 404s.

## Content

- Place primary keyword in the first 100 words of page content.
- Use internal links between related pages to distribute page authority.
- Add breadcrumb navigation with `BreadcrumbList` schema.
- Ensure all pages are reachable within 3 clicks from the homepage.

## Internationalization

- Use `hreflang` tags for multi-language sites.
- Use `lang` attribute on `<html>` element.
- Create dedicated URLs per language: `/en/about`, `/fr/about`.
