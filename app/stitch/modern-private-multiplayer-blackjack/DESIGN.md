# Velvet & Onyx

## Brand & Style

This design system establishes an exclusive, high-stakes private club atmosphere for a modern multiplayer blackjack experience. It channels the tension, discretion, and tactile magnetism of a clandestine VIP gaming lounge, balanced by precision software engineering.

The aesthetic fuses **Tactile Skeuomorphism** with **Refined Dark Glassmorphism**:
- Deep obsidian and charcoal foundational planes evoke dim salon lighting and premium finishes.
- Luminous emerald felt gradients create physical table presence without nostalgic casino clichés.
- Champagne gold, amber brilliance, and electric neon cues punctuate active player agency, chip stacks, and winning turns.
- Surfaces leverage muted backdrop blurs with razor-thin 1px metallic borders to mimic polished smoked glass and brushed titanium brass trim.
- Interfaces feel heavy, weighted, and responsive, with kinetic lighting reacting to user interactions, dealer states, and multiplayer sync.

## Layout & Spacing

The layout is built around a radial felt anchor: the central dealer hub and dynamic player arc.

### Structural Framework
- **The Table Arena:** Uses a fixed aspect-ratio viewport canvas constrained by maximum bounds (`1440px × 900px`) centered on desktop, reflowing into an elliptical tiered layout on tablet, and a vertical stacked focus-view on mobile.
- **Seat Distribution:** Up to 7 player pods sit on an elliptical CSS arc layout. Dynamic gap control collapses unseated spots and expands active player telemetry.
- **Hand Stacking System:** Split and standard hands utilize negative horizontal spacing (`card-overlap: -2.25rem`) on desktop and `-1.75rem` on mobile to show rank and suit while conserving table territory.
- **Control Bar Ribbon:** Anchored persistently to the bottom viewport with safe-area hardware insets (`env(safe-area-inset-bottom)`), maintaining a fixed height of `88px` on desktop and `76px` on mobile.

## Elevation & Depth

Visual hierarchy leverages high-refraction glassmorphism balanced with directed lighting to focus attention on active bets and the dealer’s hand.

### Layer Architecture
- **Layer 0 (Room Floor):** Deep radial vignette background (`radial-gradient(circle at 50% 35%, #132220 0%, #0B0E14 75%)`).
- **Layer 1 (The Felt Surface):** Sunken semi-matte plane surrounded by a soft, directional inset shadow (`inset 0 4px 32px rgba(0, 0, 0, 0.8)`).
- **Layer 2 (Player Pods & Card Trays):** Frosted glass panels (`rgba(17, 22, 34, 0.65)`) layered over backdrop blur (`blur(16px)`) with a crisp 1px perimeter outline (`rgba(255, 255, 255, 0.08)`).
- **Layer 3 (Floating Cards & Chips):** Tactile components cast realistic drop shadows (`0 12px 24px -6px rgba(0, 0, 0, 0.65), 0 4px 8px -2px rgba(0, 0, 0, 0.4)`).
- **Layer 4 (Active Player Turn & Overlays):** Dynamic kinetic glow. The current active seat emits an emerald/gold ambient pulse: `0 0 32px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.5)`.
- **Layer 5 (Modals & Hand Outcomes):** Full-screen smoked scrim (`rgba(11, 14, 20, 0.85)` + `backdrop-filter: blur(8px)`), elevating resolution banners with gold halo drop shadows (`0 0 48px rgba(245, 158, 11, 0.3)`).

## Components

### 1. Action Buttons (Hit, Stand, Double Down, Split)
- **Form:** Pill-shaped (`rounded-full`), height `52px` (desktop), `46px` (mobile).
- **Hit Button:** Emerald felt linear gradient (`from #10B981 to #059669`), white high-contrast bold typography, bright inner highlight (`inset 0 1px 1px rgba(255, 255, 255, 0.35)`), outer emerald halo on hover.
- **Stand Button:** Smoked crimson gradient (`from #EF4444 to #B91C1C`), distinct tactile weight.
- **Double / Split:** Frosted obsidian glass with brushed champagne gold rim (`border: 1px solid rgba(245, 158, 11, 0.4)`), gold typography, and warm amber hover luminescence.
- **Disabled State:** Opacity `0.35`, monochromatic grayscale filter, zero glow.

### 2. Playing Card Component
- **Geometry:** 2.5 : 3.5 aspect ratio with rigid linen cardstock texture.
- **Face Up:** Pristine eggshell surface (`#FDFEFE`) with micro-textured matte gradient. Pips use crisp deep vermilion (`#DC2626`) for hearts/diamonds and charcoal midnight (`#0F172A`) for spades/clubs. Space Grotesk index values on top-left and bottom-right.
- **Card Back:** Onyx weave pattern framed with metallic gold geometric border and central debossed club crest.
- **Animations:** 3D perspective flip (`transform-style: preserve-3d; transition: transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)`). Deal trajectory travels with slight rotational jitter (`±3deg`).

### 3. Casino Chips (Denominations)
- **Sizing:** 48px standard, 56px when selected, 32px when stacked in bet box.
- **Denominations:**
  - `$1` - Pearl Silver (`#E2E8F0` border, `#94A3B8` core)
  - `$5` - Carmine Scarlet (`#EF4444` with white-striped inlays)
  - `$25` - Forest Emerald (`#059669` with gold-striped inlays)
  - `$100` - Matte Obsidian (`#0F172A` with champagne gold rim)
  - `$500` - Royal Amethyst (`#7C3AED` with metallic leafing)
  - `$1,000` - Champagne Gold Plate (`#F59E0B` metallic gradient with inset debossed typography)
- **Interaction:** Selected chip scales `1.15x` and gains an upward floating offset `-8px` with a luminous gold grounding shadow.

### 4. Player Seat Pod & Turn Indicator
- **Idle State:** Translucent frosted capsule with avatar ring, player moniker, and remaining bankroll.
- **Active Turn State:** Pod receives a rhythmic 1.5-second ambient pulse of `#10B981` with an animated countdown circular SVG ring bounding the avatar.
- **Turn Warning (≤ 5s left):** Border and countdown shift to amber `#F59E0B` and finally pulsing crimson `#EF4444`.
- **Result Badges:** Instant pill tags snapping over the hand:
  - `BLACKJACK`: Rich gold leaf gradient with gold sparkle aura.
  - `WIN`: Electric teal outline with emerald glow.
  - `PUSH`: Translucent gray outline.
  - `BUST`: Ruby red wash with subtle shake animation.

### 5. Betting Spots (Table Inlays)
- **Shape:** Soft stadium pill with dashed 1.5px border (`rgba(255, 255, 255, 0.15)`).
- **Active State:** Border snaps to solid `#10B981` with an interior radial teal gradient when bets are placed or chips are dragged overhead.
