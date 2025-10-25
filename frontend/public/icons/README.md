# PWA Icon Generation Instructions

## Required Icon Sizes
The following icon sizes are needed for the PWA manifest:

- 72x72px
- 96x96px  
- 128x128px
- 144x144px
- 152x152px
- 192x192px
- 384x384px
- 512x512px

## How to Generate Icons

### Option 1: Online Converter
1. Go to https://realfavicongenerator.net/
2. Upload the `icon.svg` file
3. Download the generated icons
4. Place them in the `frontend/public/icons/` directory

### Option 2: Using ImageMagick (if installed)
```bash
# Convert SVG to different PNG sizes
magick icon.svg -resize 72x72 icon-72x72.png
magick icon.svg -resize 96x96 icon-96x96.png
magick icon.svg -resize 128x128 icon-128x128.png
magick icon.svg -resize 144x144 icon-144x144.png
magick icon.svg -resize 152x152 icon-152x152.png
magick icon.svg -resize 192x192 icon-192x192.png
magick icon.svg -resize 384x384 icon-384x384.png
magick icon.svg -resize 512x512 icon-512x512.png
```

### Option 3: Using Node.js (if sharp is installed)
```bash
npm install sharp
node -e "
const sharp = require('sharp');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(size => {
  sharp('icon.svg')
    .resize(size, size)
    .png()
    .toFile(\`icon-\${size}x\${size}.png\`);
});
"
```

## Icon Design
The SVG icon includes:
- Blue circular background (#3b82f6)
- White dumbbell symbol
- AI sparkle (yellow)
- Voice wave (green)

This represents the core features of GymSage:
- Fitness/workout tracking (dumbbell)
- AI-powered features (sparkle)
- Voice recognition (wave)
