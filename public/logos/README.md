# Logos Folder

This folder contains all logo assets for the SnipIt application.

## Usage

To use logos in your components, reference them like this:

```jsx
import Image from 'next/image';

// Example usage
<Image src="/logos/your-logo.png" alt="Your Logo" width={100} height={100} />;
```

## Supported Formats

- PNG
- SVG
- JPG/JPEG
- ICO (for favicons)

## Naming Convention

Use descriptive names for your logo files:

- `logo-main.png` - Main logo
- `logo-icon.svg` - Icon version
- `logo-white.png` - White version for dark backgrounds
- `logo-dark.png` - Dark version for light backgrounds
