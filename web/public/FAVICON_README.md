# Favicon Assets

The following favicon files are referenced in the metadata but need to be generated:

## Required Files

You can generate these from `favicon.svg` using a tool like [RealFaviconGenerator](https://realfavicongenerator.net/) or [Favicon.io](https://favicon.io/):

### Standard Favicons
- `favicon-16x16.png` - 16x16px
- `favicon-32x32.png` - 32x32px
- `favicon.ico` - Multi-size ICO (optional, browsers will use SVG)

### Apple Touch Icon
- `apple-touch-icon.png` - 180x180px

### Android Chrome Icons
- `android-chrome-192x192.png` - 192x192px
- `android-chrome-512x512.png` - 512x512px

### Open Graph Image
- `og-image.png` - 1200x630px (for social media previews)

### Screenshots (Optional for PWA)
- `screenshot-desktop.png` - 1280x720px
- `screenshot-mobile.png` - 750x1334px

## Quick Generation

You can use online tools or install a CLI tool:

```bash
# Using npm
npx @svgr/cli favicon.svg --out-dir favicons

# Or use online tools
# 1. Upload favicon.svg to https://realfavicongenerator.net/
# 2. Download the generated package
# 3. Extract all files to /public directory
```

## Current Status

✅ `favicon.svg` - Created (vector version, works in all modern browsers)
⏳ PNG versions - Need to be generated for older browsers and mobile devices
⏳ OG image - Need to create for social media sharing

