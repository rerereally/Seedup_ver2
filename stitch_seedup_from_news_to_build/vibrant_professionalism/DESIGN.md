---
name: Vibrant Professionalism
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#5c403a'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#916f68'
  outline-variant: '#e6bdb5'
  surface-tint: '#bb1900'
  primary: '#b61800'
  on-primary: '#ffffff'
  primary-container: '#de2e12'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb4a6'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#006387'
  on-tertiary: '#ffffff'
  tertiary-container: '#007daa'
  on-tertiary-container: '#fcfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad3'
  primary-fixed-dim: '#ffb4a6'
  on-primary-fixed: '#3f0300'
  on-primary-fixed-variant: '#8f1100'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7cd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.3'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style

This design system blends **Corporate Modern** reliability with a **High-Contrast** energetic edge. The primary objective is to facilitate high-density information consumption while maintaining a sense of momentum and technical precision. 

The aesthetic is characterized by expansive whitespace, structured information hierarchies, and a "surgical" use of a high-visibility accent color. It targets a professional audience that values efficiency, data clarity, and a modern, forward-thinking interface. The shift from soft greens to a vibrant orange and deep charcoal signals urgency and decisiveness, perfect for platforms centered around trends and performance.

## Colors

The palette is anchored by the interplay between a vibrant primary orange and a sophisticated deep charcoal.

- **Primary (#FF4628):** Reserved for high-priority actions, active navigation states, and critical highlights. It acts as the "heat map" of the UI.
- **Secondary/Text (#202020):** Used for primary typography and dark-themed structural blocks (e.g., footers or high-impact cards) to provide grounded contrast.
- **Neutral Surface:** Utilizes a range of cool grays to define containers and separators without competing with the content.
- **Success/Warning/Error:** Standard functional palettes should be desaturated to ensure the primary orange remains the undisputed focal point of the interface.

## Typography

This design system utilizes **Inter** exclusively to leverage its systematic, utilitarian nature. The type scale is optimized for legibility in dense SaaS environments.

- **Headlines:** Use tighter letter-spacing and heavier weights to create a strong visual anchor.
- **Body:** Prioritize a generous line height (1.6) to ensure long-form text remains readable and approachable.
- **Labels:** Used for metadata and UI controls. Weights are bumped to 500 (Medium) to maintain clarity at smaller sizes.
- **Contrast:** High-contrast text (#202020) should be used for all primary information, while secondary data uses a muted 60% opacity of the charcoal.

## Layout & Spacing

The design system employs a **12-column fluid grid** for web, transitioning to a **4-column grid** for mobile. 

- **The Header:** Follows a horizontal distribution. The logo sits at the far left, followed by a grouped navigation. The search bar is centrally weighted or pushed right-center, with the primary action (Login) anchoring the far right.
- **Rhythm:** An 8px linear scale is the standard for component spacing, while 4px (base) is used for tight internal component padding.
- **Margins:** Desktop margins are fixed at 40px, while mobile margins scale down to 16px to maximize screen real estate.

## Elevation & Depth

Visual hierarchy is achieved through **low-contrast outlines** and **tonal layering** rather than heavy shadows.

- **Surfaces:** Use subtle off-white backgrounds (#F8F9FA) for container backgrounds to separate them from the pure white page background.
- **Borders:** Component boundaries use 1px solid borders in a light neutral tone. 
- **Active States:** Depth is communicated by a shift in color (Primary Orange) or a very subtle, diffused ambient shadow (10% opacity) to indicate hover.
- **Overlays:** Modals and dropdowns use a sharp, 1px border with a medium-diffusion shadow to lift them clearly above the content plane.

## Shapes

The shape language is defined by **Rounded (8px)** corners, providing a professional yet modern feel that avoids the clinical nature of sharp corners or the playfulness of full pills for large containers.

- **Standard Elements:** Buttons, input fields, and cards utilize the base 0.5rem (8px) radius.
- **Interactive Pills:** Specific high-priority buttons (like 'Login') and the search bar use the `rounded-xl` or full pill setting to draw the eye and signify interactivity.
- **Search Bar:** Specifically utilizes a highly rounded border to create a soft, inviting entry point for user input.

## Components

### Header
The header is the primary navigation hub. 
- **Navigation Links:** `label-md`, weight 500. Active states use the primary orange with a 2px bottom underline.
- **Search Bar:** A rounded pill with a light border, containing a search icon and placeholder text.
- **Login Button:** A solid pill-shaped button using either the Primary Orange or Deep Charcoal for high contrast.

### Buttons
- **Primary:** Solid #FF4628 with white text.
- **Secondary:** Outlined deep charcoal or solid light gray.
- **Size:** Large buttons (48px height) for primary CTAs; medium (40px) for standard UI actions.

### Input Fields
- **Search:** Rounded pill shape as defined in the header style.
- **Standard:** 8px rounded corners, 1px neutral border, focusing to a primary orange border.

### Cards & Lists
- **Cards:** 1px border, 8px radius, no shadow unless hovered.
- **Lists:** Clean dividers, 16px vertical padding, with primary orange used for specific data highlights or "new" tags.

### Chips & Tags
- Used for categories (News, Trends). Small 4px radius or pill-shaped, using a light tint of the primary color or a neutral gray.