# Hidden Gems — Cursor Implementation Handoff

> **How to use this document:** Work through each numbered step in order. Every step tells you exactly what files to create, what logic to implement, what state to manage, which design file to reference, and what edge cases to handle. A developer who has never spoken to the designer should be able to build the complete app from this document alone.

---

## 1. Overview

Hidden Gems is a social geo-discovery mobile app for iOS and Android built with **Expo / React Native**. Users discover, save, and share hidden local spots (beaches, viewpoints, secret gardens). They connect with other explorers via communities, direct messages, and Gem Swipe (a card-swipe discovery mode). A Pro subscription unlocks Gem Swipe, Trip Planner, and advanced filters.

**Design reference files:** 13 `.dc.html` files are included in this folder. Open each in any modern browser. All are interactive — toggle dark/light mode with the button top-right, tap buttons to see state changes. These are **pixel-accurate design references**, not production code. Recreate them exactly in React Native.

---

## 2. Fidelity

**High-fidelity.** Every screen has final:
- Exact hex colour values
- Font families, sizes, weights, letter-spacing
- Border radii, shadows, padding, spacing
- All interactive states: active, loading, error, empty, skeleton, disabled
- iOS and Android platform-specific annotations

Do not invent new colours, fonts, or spacing values. If something is unclear, open the corresponding `.dc.html` file and inspect it.

---

## 3. Design Files Index

| File | Screens / Panels |
|---|---|
| `Hidden Gems Design Review.dc.html` | Discover, Profile (own), Notifications, Achievement Modal, Sign-in, Map, Add Gem, Gem Detail |
| `Hidden Gems - Onboarding + Paywall.dc.html` | Intro story screens (4), Category picker, Trial offer, You're all set, Paywall |
| `Hidden Gems - Social + Premium.dc.html` | Gem Swipe, 1:1 Chat, Communities list |
| `Hidden Gems - Final Screens.dc.html` | Trip Planner, Settings (top level), Admin panel |
| `Hidden Gems - Missing Screens.dc.html` | Messages inbox, Profile (other user), Followers/Following list, Community Detail (Feed+Chat tabs), Gem Detail Comments + Check-in confirmation |
| `Hidden Gems - Brand Assets.dc.html` | App icon (all sizes + platform shapes), Splash screen with typing animation, 8 achievement badge SVGs, OG share image (1200×630) |
| `Hidden Gems - Skeletons + Empty States.dc.html` | Communities loading, Communities Mine empty, Trip Planner searching, Gem Swipe loading, Gem Swipe empty, Keyboard-open states (Chat, Comments, Auth on iPhone SE) |
| `Hidden Gems - System Patterns.dc.html` | Toast/error system (4 types), Navigation transitions spec, Push notification designs (3 categories + in-app banner), Global search, Bottom sheet anatomy + snap point specs |
| `Hidden Gems - Final Spec.dc.html` | Tab bar (interactive, all states), Light mode WCAG contrast audit, iOS platform gaps, Android platform gaps |
| `Hidden Gems - Auth + Permission Flows.dc.html` | Sign-up step 1 (credentials), Step 2 (username), Step 3 (photo), Forgot password (2 states), Pre-permission screens (Location, Camera, Notifications) |
| `Hidden Gems - Remaining Flows.dc.html` | Gem edit, Photo picker sheet, Report flow, Community creation, Settings sub-screens (Notifications prefs, Privacy, Account deletion), Billing failure, Rate app prompt, Trip export sheet, Web deep link landing page |
| `Hidden Gems - High Priority Gaps.dc.html` | Email verification (check inbox + verified states), Fullscreen photo viewer, Leaderboard, Permission denied recovery (in-app), Gem pending/rejected states on profile, Follow suggestions (post sign-up) |
| `Hidden Gems - Medium Priority Gaps.dc.html` | Map pin clustering (interactive), Block/mute action sheet + resulting states, Community moderation (Manage tab), Load-more pagination (4 states), Deferred deep link first-open |

---

## 4. Tech Stack

```
Expo SDK 51+
React Native
TypeScript
expo-router (file-based navigation)
Zustand (state management)
React Query / TanStack Query (server state + caching)
@gorhom/bottom-sheet
react-native-maps
react-native-reanimated 3
react-native-gesture-handler
expo-image-picker
expo-location
expo-haptics
expo-notifications
expo-status-bar
expo-navigation-bar
react-native-safe-area-context
AsyncStorage
Branch.io (deferred deep links)
@vercel/og (OG image server)
```

---

## 5. Project Structure

```
app/
  _layout.tsx              ← Root layout: ThemeProvider, ToastProvider, NavigationBar setup
  (auth)/
    index.tsx              ← Sign-in
    sign-up/
      step1.tsx            ← Credentials
      step2.tsx            ← Username
      step3.tsx            ← Profile photo
    forgot-password.tsx
    verify-email.tsx
  (tabs)/
    _layout.tsx            ← Tab bar
    index.tsx              ← Discover
    map.tsx
    swipe.tsx
    profile.tsx
  gem/
    [id].tsx               ← Gem Detail
    [id]/comments.tsx      ← Comments (keyboard-open state)
  profile/
    [username].tsx         ← Other user profile
    [username]/followers.tsx
  messages/
    index.tsx              ← Inbox
    [conversationId].tsx   ← 1:1 Chat
  communities/
    index.tsx              ← Communities list
    [id].tsx               ← Community Detail (Feed/Chat/Manage tabs)
    create.tsx
  search.tsx               ← Global search (modal)
  notifications.tsx
  leaderboard.tsx
  trip-planner.tsx
  settings/
    index.tsx
    notifications.tsx
    privacy.tsx
    account.tsx

components/
  GemCard.tsx
  UserAvatar.tsx
  Toast.tsx
  BottomSheet.tsx          ← wrapper around @gorhom/bottom-sheet
  LoadMore.tsx
  EmptyState.tsx
  SkeletonCard.tsx
  AchievementBadge.tsx
  TabBar.tsx
  MapPin.tsx
  PermissionExplain.tsx
  PermissionDeniedBanner.tsx
  CategoryBadge.tsx
  HapticPressable.tsx      ← Pressable + ripple + optional haptic

stores/
  authStore.ts
  themeStore.ts
  gemStore.ts
  userStore.ts
  notificationStore.ts
  toastStore.ts

hooks/
  useTheme.ts
  useSafeInsets.ts
  usePermission.ts
  useDeepLink.ts

lib/
  theme.ts
  typography.ts
  spacing.ts
  haptics.ts
  api.ts

assets/
  icon.png                 ← 1024×1024
  splash.png               ← compass on #0B1A1C
  adaptive-icon.png        ← Android foreground (compass in 66% canvas)
  notification-icon.png    ← Monochrome compass, 96×96, Android only
```

---

## 6. Design Tokens

### 6.1 Colours — `lib/theme.ts`

```ts
export const darkTheme = {
  background:    '#0B1A1C',
  card:          '#142B2E',
  bgTertiary:    '#1C3438',
  border:        '#1C3438',   // same as bgTertiary — intentional
  text:          '#EAF6F4',
  textSecondary: '#7FA8A8',
  textTertiary:  '#5C8484',
  accent:        '#2DD4BF',   // teal — ALL primary interactive elements
  accentSub:     '#1C3438',   // teal tint background
  coral:         '#FF9F5A',   // FAB, achievement coral badges, "you" avatar
  homeIndicator: 'rgba(234,246,244,0.2)',
};

export const lightTheme = {
  background:    '#F7FAF9',
  card:          '#FFFFFF',
  bgTertiary:    '#E3F1EF',
  border:        '#DCE8E6',
  text:          '#0B1A1C',
  textSecondary: '#5B7472',
  textTertiary:  '#8FA3A1',
  accent:        '#0F9488',
  accentSub:     '#E3F1EF',
  coral:         '#E8723D',
  homeIndicator: 'rgba(11,26,28,0.18)',
};

// Semantic — same in both modes
export const semantic = {
  error:   '#F87171',
  warning: '#FBBF24',
  success: '#22C55E',
  gold:    '#FFD700',
  silver:  '#C0C0C0',
  bronze:  '#CD7F32',
};

export type Theme = typeof darkTheme;
```

### 6.2 Typography — `lib/typography.ts`

Two fonts only. **Space Grotesk** for all UI text. **Space Mono** for data, coordinates, timestamps, overline labels, badges, monospace spec.

```ts
export const typography = {
  h1:     { fontFamily: 'SpaceGrotesk-Bold',     fontSize: 38, lineHeight: 46 },
  h2:     { fontFamily: 'SpaceGrotesk-Bold',     fontSize: 24, lineHeight: 30 },
  h3:     { fontFamily: 'SpaceGrotesk-Bold',     fontSize: 22, lineHeight: 28 },
  h4:     { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 17, lineHeight: 22 },
  h5:     { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 16, lineHeight: 22 },
  body:   { fontFamily: 'SpaceGrotesk-Regular',  fontSize: 14, lineHeight: 22 },
  bodyS:  { fontFamily: 'SpaceGrotesk-Regular',  fontSize: 13, lineHeight: 20 },
  bodyXS: { fontFamily: 'SpaceGrotesk-Regular',  fontSize: 12, lineHeight: 18 },
  label:  { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 15, lineHeight: 20 },
  labelS: { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 13, lineHeight: 18 },
  // Mono
  monoXL: { fontFamily: 'SpaceMono-Regular', fontSize: 18 },
  monoL:  { fontFamily: 'SpaceMono-Regular', fontSize: 13 },
  monoM:  { fontFamily: 'SpaceMono-Regular', fontSize: 11 },
  monoS:  { fontFamily: 'SpaceMono-Regular', fontSize: 10 },
  // Overline — always uppercase, always SpaceMono
  monoXS: { fontFamily: 'SpaceMono-Regular', fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase' as const },
};
```

**WCAG contrast rule (light mode):**
- SpaceMono labels ≤ 11px: use `theme.textSecondary` (#5B7472, 5.1:1 ratio) — NOT accent
- SpaceMono labels ≥ 12px or bold: accent colour is fine (passes AA for large text)
- This affects: category overlines on gem cards, section separators, coord labels

### 6.3 Spacing — `lib/spacing.ts`

```ts
export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,   // standard page padding
  xl:   20,
  xxl:  24,
  page: 16,
};
```

### 6.4 Radii

```ts
export const radii = {
  xs:    6,
  sm:    8,
  md:    10,
  lg:    12,
  xl:    14,
  xxl:   20,
  full:  9999,
  card:  14,
  pill:  20,
  modal: 20,   // bottom sheet top corners only
};
```

### 6.5 Shadows

**Always pair iOS shadow props with Android elevation:**

```ts
export const shadows = {
  card: {
    shadowColor:   '#000',
    shadowOpacity: 0.08,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 4 },
    elevation: 2,   // Android — without this, cards are flat
  },
  modal: {
    shadowColor:   '#000',
    shadowOpacity: 0.28,
    shadowRadius:  32,
    shadowOffset:  { width: 0, height: 16 },
    elevation: 8,
  },
};
```

---

## 7. Data Models — `lib/types.ts`

```ts
export type Gem = {
  id: string;
  name: string;
  description: string;
  category: GemCategory;
  location: { lat: number; lng: number; placeName: string };
  photos: string[];           // URLs
  authorId: string;
  likeCount: number;
  checkInCount: number;
  isLiked: boolean;
  isSaved: boolean;
  visibility: 'public' | 'friends' | 'private';
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
};

export type GemCategory =
  | 'Views' | 'Hidden' | 'Beach' | 'Hiking'
  | 'Food' | 'Culture' | 'Night' | 'Adventure';

export type User = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  level: number;               // 1–5
  gemCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;        // current user → this user
  isFollowedBy: boolean;       // this user → current user
  isBlocked: boolean;
  isMuted: boolean;
  isVerified: boolean;         // email verified
  isPro: boolean;
  isAdmin: boolean;
  joinedAt: string;
};

export type Community = {
  id: string;
  name: string;
  description: string;
  coverUrl?: string;
  memberCount: number;
  type: 'open' | 'invite_only';
  location?: string;
  isJoined: boolean;
  isCreator: boolean;
  pendingRequestCount?: number;  // creator only
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sentAt: string;
  isRead: boolean;
};

export type Conversation = {
  id: string;
  participant: User;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isRequest: boolean;          // message request from non-follower
};

export type Notification = {
  id: string;
  type: 'nearby_gem' | 'follow' | 'like' | 'comment' | 'achievement' | 'community';
  title: string;
  body: string;
  data: Record<string, string>;
  isRead: boolean;
  createdAt: string;
};

export type Achievement = {
  id: string;
  type: AchievementType;
  unlockedAt?: string;         // undefined = locked
};

export type AchievementType =
  | 'pioneer'       // first gem dropped
  | 'navigator'     // 10 check-ins
  | 'pathfinder'    // 50 check-ins
  | 'trailblazer'   // 25 gems dropped
  | 'localLegend'   // 5 gems in one area
  | 'founding'      // early supporter
  | 'secretFind'    // gem with < 3 visitors
  | 'connector';    // joined 3 communities
```

---

## 8. State Management — Zustand Stores

### `stores/authStore.ts`
```ts
type AuthState = {
  user: User | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  onboardingComplete: boolean;
  onboardingSource: 'normal' | 'deep_link' | null;
  pendingDeepLinkGemId: string | null;   // gem to show after auth
};
```

### `stores/themeStore.ts`
```ts
type ThemeState = {
  scheme: 'dark' | 'light' | 'system';
  // computed: actual dark/light based on scheme + system preference
};
```

### `stores/toastStore.ts`
```ts
type ToastState = {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
};

type Toast = {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  autoDismiss?: boolean;   // false for error toasts
};
```

### `stores/notificationStore.ts`
```ts
type NotificationState = {
  unreadCount: number;
  swipeUnreadCount: number;    // badge on Swipe tab
};
```

---

## 9. Navigation Map

```
Root
├── (auth) group — no tab bar
│   ├── /                → Sign-in
│   ├── /sign-up/step1   → Sign-up credentials
│   ├── /sign-up/step2   → Username
│   ├── /sign-up/step3   → Profile photo
│   ├── /forgot-password → Forgot password
│   └── /verify-email    → Email verification pending
│
├── (tabs) group — with tab bar
│   ├── /               → Discover
│   ├── /map            → Map
│   ├── /swipe          → Gem Swipe (Pro gate)
│   └── /profile        → Own profile
│
├── /gem/[id]           → Gem Detail (stack push)
├── /profile/[username] → Other user profile (stack push)
├── /profile/[username]/followers → Followers/Following (stack push)
├── /messages           → Messages inbox (stack push)
├── /messages/[id]      → 1:1 Chat (stack push)
├── /communities        → Communities list (stack push)
├── /communities/[id]   → Community Detail (stack push)
├── /communities/create → Community creation (modal)
├── /search             → Global search (modal, full-screen)
├── /notifications      → Notifications (stack push)
├── /leaderboard        → Leaderboard (stack push)
├── /trip-planner       → Trip Planner (stack push)
├── /settings           → Settings (stack push)
├── /settings/notifications → Notification prefs (stack push)
├── /settings/privacy   → Privacy settings (stack push)
└── /settings/account   → Account deletion (stack push)

Bottom sheets (rendered at root, not routes):
├── AddGem              → snap: 90%
├── EditGem             → snap: 90%
├── PhotoPicker         → snap: auto
├── CheckIn             → snap: auto
├── Report              → snap: auto
├── BlockMute           → snap: auto
├── TripExport          → snap: auto
└── AchievementUnlock   → snap: auto
```

---

## STEP 1 — Foundation

**Reference:** `Hidden Gems - Final Spec.dc.html` (tokens), `Hidden Gems - System Patterns.dc.html` (bottom sheet)

### 1.1 Install packages
```bash
npx expo install expo-font @expo-google-fonts/space-grotesk @expo-google-fonts/space-mono
npx expo install expo-status-bar expo-navigation-bar expo-haptics expo-location
npx expo install expo-image-picker expo-notifications
npx expo install react-native-safe-area-context react-native-screens
npx expo install react-native-maps react-native-reanimated react-native-gesture-handler
npx expo install @gorhom/bottom-sheet
npx expo install @tanstack/react-query zustand
npx expo install @react-native-async-storage/async-storage
```

### 1.2 `app/_layout.tsx` — root setup
```tsx
// Load fonts first — app must not render until fonts are ready
// Set up ThemeProvider (reads system preference, persists to AsyncStorage)
// Set up QueryClient provider
// Set up GestureHandlerRootView (required by @gorhom/bottom-sheet)
// Set up BottomSheetModalProvider
// Set up ToastContainer (rendered here, floats above all screens)
// Android: call NavigationBar.setBackgroundColorAsync(theme.background) on mount + theme change
// Listen for app foreground event → re-check permissions, recheck notification grants
```

### 1.3 Build shared components

#### `<GemCard />`
```
Props: gem: Gem, onPress: () => void, size: 'full' | 'compact' | 'mini'
full:    full-width, 100px height, image left 100px wide
compact: full-width, 80px height, image left 80px wide
mini:    80×80px square, no text (thumbnail grid use)

Image: gradient placeholder until loaded (same dark gradient from design files)
Category badge: 9px SpaceMono monoXS, accentSub bg, accent border, accent text, 6px radius
Title: SpaceGrotesk-Bold 14px
Meta: SpaceMono 10px textSecondary, "♥ N · Location"
Pending: amber border (1px #FBBF24) + diagonal hatch overlay (opacity 0.15) + "UNDER REVIEW" amber badge
Rejected: red border (1px #F87171) + hatch overlay + red "REJECTED" badge + rejection reason text
```

#### `<UserAvatar />`
```
Props: user: User, size: number, showBadge?: boolean, badgeCount?: number
No avatarUrl: first initial of displayName, SpaceGrotesk-Bold, coral (#FF9F5A dark / #E8723D light) background
With avatarUrl: circular Image, borderRadius: size/2
Badge (unread dot): 13px, #F87171, border: 2px theme.background, position: absolute top-right
```

#### `<Toast />`
```
Rendered at root level via toastStore, floats over all content
Position: top, below statusBar + safeAreaInsets.top + 8px gap
Layout: card bg, left border 3px (teal/red/amber/teal), 12px 14px padding, 14px radius
Icon: 28px circle (colour tint), SVG icon inside
Title: SpaceGrotesk-SemiBold 13px text
Subtitle: SpaceMono 10px textSecondary
Action button (error toasts): small pill, coloured bg
Animation: Reanimated translateY from -80 → 0, opacity 0→1, 300ms
Auto-dismiss: success/warning/info = 4000ms, error = never (manual dismiss only)
Haptic on appear: hapticMedium() for error, none for others
Swipe up to dismiss: hapticMedium() on swipe
```

#### `<BottomSheet />`
```
Wraps @gorhom/bottom-sheet BottomSheetModal
handleComponent: View with 36×4px pill, theme.border colour, centred, marginTop:14
backdrop: BottomSheetBackdrop at 45% opacity, tap-to-dismiss (disabled for AddGem)
overScrollMode: "never" (iOS scroll bounce)
activeOffsetY: [-1, 1] (prevents conflict with gestures inside the sheet)
enablePanDownToClose: true
Android: supply onRequestClose via context/prop — required for hardware back
AddGem specifically: onRequestClose shows confirm dialog if form has any filled fields
```

#### `<LoadMore />`
```
Props: status: 'loading' | 'end' | 'error' | 'idle', onRetry?: () => void, count?: number
loading: 52px height, row centred, 16px teal spinner (border-top transparent, spin animation) + "Loading more…" SpaceMono 11px textTertiary
end:     52px height, row with flex:1 dividers either side + "You've seen all {count} gems" SpaceMono 10px textTertiary centred
error:   52px height, red-border card, error icon + "Couldn't load more" + "Retry" pill
idle:    null (renders nothing)

Use as ListFooterComponent on ALL FlatLists in the app
Set onEndReachedThreshold={0.3} on parent FlatList
```

#### `<EmptyState />`
```
Props: icon: string (SVG name), title: string, subtitle: string, cta?: string, onCta?: fn, secondaryCta?: string, onSecondaryCta?: fn
Layout: column, centred, padding 24px 32px
Icon: 88px circle, bgTertiary bg, 12px accentSub ring (box shadow 0 0 0 12px accentSub)
Overline: SpaceMono monoXS, accent colour, 8px below icon (e.g. "No communities yet")
Title: SpaceGrotesk-Bold 22px text, centred, lineHeight 1.25
Subtitle: SpaceGrotesk 14px textSecondary, centred, lineHeight 1.6
CTA button: accent bg, full width, 50px height, 12px radius, SpaceGrotesk-Bold 15px #0A1F1C
Secondary: plain text, textSecondary, 13px, below CTA
```

#### `<SkeletonCard />`
```
Shimmer gradient (Reanimated Animated.View with interpolated backgroundImage):
  dark:  '#142B2E' → '#1e3e42' → '#142B2E'  (sweeps left to right)
  light: '#dce8e6' → '#edf6f4' → '#dce8e6'

Animation: 1600ms infinite loop, backgroundPosition 0 → full width
Shape: MUST match the real card exactly — same width, height, border-radius
Multi-card: stagger each card by +200ms delay
Fade-out: reduce opacity 1.0 → 0.6 → 0.4 on last 1-2 cards (signals more below)
```

#### `<AchievementBadge />`
```
Props: type: AchievementType, locked?: boolean, size?: number (default 48)

Icon lookup (use SVG icons as described in Brand Assets design file):
  pioneer:     diamond outline (square rotated 45°, teal)
  navigator:   compass with N/S/E/W lines (teal)
  pathfinder:  compass needle pointing up, diamond shape (coral needle, teal outline)
  trailblazer: mountain peaks (teal)
  localLegend: two people figures (coral)
  founding:    5-point star outline (coral)
  secretFind:  eye with iris (teal)
  connector:   two people + plus icon (coral)

locked=true: apply { filter: 'grayscale(1)', opacity: 0.4 } — same component, NO separate locked icons
Unlock animation (when locked → unlocked):
  1. hapticSuccess()
  2. Full-screen teal flash: opacity 0 → 0.15 → 0, duration 500ms
  3. Show AchievementUnlock bottom sheet (auto-dismiss 5s or tap to dismiss)
```

#### `<HapticPressable />`
```
Wraps Pressable, adds android_ripple by default, optional haptic on press
Props: ...PressableProps, haptic?: 'light'|'medium'|'success', rippleColor?: string
android_ripple: { color: theme.accentSub, borderless: false }
Use this for ALL list rows, CTAs, action buttons — never plain TouchableOpacity
```

### 1.4 Platform setup

```ts
// app/_layout.tsx — call on mount and on theme change
import * as NavigationBar from 'expo-navigation-bar';
NavigationBar.setBackgroundColorAsync(theme.background);  // Android only

// Global StatusBar defaults:
// Dark screens (map, gem detail, photo viewer, onboarding): style="light"
// Light mode: style="dark"
// Auto: style="auto" reads system theme

// Safe area: NEVER hardcode top/bottom pixel values
// ALWAYS: const insets = useSafeAreaInsets();
// Use: paddingTop: insets.top, paddingBottom: insets.bottom + 16
```

---

## STEP 2 — Auth Flow

**Reference:** `Hidden Gems - Auth + Permission Flows.dc.html`, `Hidden Gems - High Priority Gaps.dc.html` (Col 1)

### 2.1 App launch logic

```ts
// On app launch (before any screen renders):
// 1. Load fonts
// 2. Check AsyncStorage for auth token
// 3. If token: validate with server, populate authStore.user
// 4. Check Branch.io / Firebase Dynamic Links for deferred deep link payload
//    If payload found: store gemId in authStore.pendingDeepLinkGemId
// 5. Navigate:
//    - No token → (auth)/index (sign-in)
//    - Token + onboardingComplete + verified → (tabs)/index (Discover)
//    - Token + !onboardingComplete → onboarding flow
//    - Token + !isEmailVerified → (auth)/verify-email
```

### 2.2 Sign-in screen

```
Layout: logo row (compass SVG 26px + "Hidden Gems" SpaceGrotesk-Bold 15px)
        Email field (textContentType="emailAddress", keyboardType="email-address")
        Password field (textContentType="password", secureTextEntry, "Show" text toggle)
        returnKeyType="go" → submits form
        Sign-in button (accent, full-width, 50px)
        OR divider
        Apple SSO + Google SSO (card bg, border, 46px height each)
        "Create account" link

Inline error (wrong credentials):
  - Red border on both fields
  - 5px red dot + SpaceMono 10px red text below: "Incorrect email or password"
  - Clears on first keystroke (onChangeText)

iPhone SE check (667pt − 260pt keyboard = 407pt available):
  All elements must fit: logo + "Sign in" heading + 2 fields + button + "Forgot password?" = ~340pt ✓
  No tagline or animation on this screen — stripped to essentials only
```

### 2.3 Sign-up flow — 3 steps

**Step 1 — Credentials** (`/sign-up/step1`)
```
Progress bar: 3 segments, first filled (accent), rest unfilled (border)
Fields: Full name, Email (textContentType="emailAddress"), Password (textContentType="newPassword")
Password strength bar (4 segments):
  - Use zxcvbn library to score password in real-time
  - Score 0: no fill
  - Score 1: 1 red segment ("Weak")
  - Score 2: 2 amber segments ("Fair")
  - Score 3: 3 teal segments ("Strong")
  - Score 4: 4 teal segments ("Very strong")
  - Label in SpaceMono 9px to the right of bar
CTA: "Continue →" → navigate to step 2
SSO options below divider (Apple + Google — these skip steps 2+3, generate username automatically)
```

**Step 2 — Username** (`/sign-up/step2`)
```
Progress bar: 2 of 3 filled
@ prefix inside input field (SpaceMono 16px textTertiary, not editable)
Input: SpaceMono 16px, accent border when focused

Validation rules (show in a ticked checklist below the field):
  - 4–20 characters ✓/✗
  - Letters, numbers, underscores only ✓/✗
  - Available ✓/✗ (checked against server)

Availability check:
  - Debounce: 400ms after last keystroke
  - While checking: spinner in right of field
  - Available: teal checkmark in field + green dot + "available" label below
  - Taken: red × in field + red dot + "taken" label below

Suggestions: 3 chips from server (generated from displayName, all guaranteed available)
  - Tapping a chip fills the field and triggers immediate validation

CTA "Continue →" disabled until valid + available
```

**Step 3 — Profile photo** (`/sign-up/step3`)
```
Progress bar: all 3 filled
Avatar preview: 120px circle, coral bg, first initial (SpaceGrotesk-Bold 48px #fff)
Camera icon button: 32px teal circle, bottom-right of avatar, triggers photo picker

Options:
  "Take a photo" → requests camera permission FIRST (pre-permission explain screen)
  "Choose from library" → requests photo library permission first
  "Skip for now" → completes registration with initial avatar

On photo selected: show circular crop preview in avatar slot

CTA: "Finish →" or "Skip for now" (below CTA as text link)

On complete:
  - If authStore.pendingDeepLinkGemId exists → show deferred deep link sign-up screen instead of normal flow
  - Else → show follow suggestions screen (post sign-up)
  - Mark onboardingComplete = false until category picker + follow suggestions done
```

### 2.4 Forgot password

```
State A — email input:
  Envelope icon (72px circle, bgTertiary bg)
  Email field (accent border, active)
  Security note: "We won't reveal whether an account exists" (important — prevents enumeration)
  "Send reset link" button

State B — check inbox (after submit):
  Ticked envelope icon (accentSub bg, accent border)
  Email address shown in accent colour
  "Open email app" → Linking.openURL('mailto:') (opens default mail app)
  Countdown: "Resend in 0:58" ticks down every second
  After 60s: "Resend now" (active teal link) — re-sends email, restarts timer
  "Change email" → back to State A pre-filled

Note: show SAME State B whether or not email exists (security)
```

### 2.5 Email verification

```
State A — check inbox:
  Same envelope illustration
  "Verify your email" SpaceMono overline (accent)
  Email address in SpaceMono accent
  "Open email app" CTA
  Countdown resend timer (same as forgot password)
  "Wrong address? Change email →" → back to sign-up step 1

State B — verified (triggered when verify link is opened):
  Teal checkmark circle (88px, accentSub bg, accent border)
  "Email verified" SpaceMono overline
  "Start exploring →" CTA → navigate to (tabs)

Verify link = Universal Link: hiddengems.app/verify?token=…
  Server validates token, marks user as verified
  App reads the result via Linking.addEventListener or getInitialURL

Unverified users CAN browse the app — verification gates:
  - Posting a new gem
  - Sending a direct message
Soft banner on profile (not blocking): "Verify your email to post gems →"
```

### 2.6 Deferred deep link sign-up screen

**Reference:** `Hidden Gems - Medium Priority Gaps.dc.html` (Col 5)

```
Triggered when: authStore.pendingDeepLinkGemId exists AND user is not signed in

Layout:
  Teal "BROUGHT YOU HERE" banner at top:
    Pin icon + gem name + "You'll see this gem after signing up"
    Background: accentSub, border: accent, 12px radius
  "Create your account" heading
  "Takes 30 seconds — then we'll take you to the gem" subtitle
  SSO FIRST (Apple + Google) — these users are high-intent, fastest path
  OR divider
  Email input below

CTA: "Sign up + see gem →" (not generic "Create account")

Post sign-up:
  1. Skip category picker + follow suggestions for now
  2. Navigate directly to /gem/[pendingDeepLinkGemId]
  3. Store flag: onboardingSource = 'deep_link'
  4. On NEXT app open: show category picker + follow suggestions
  5. Clear pendingDeepLinkGemId from store
```

---

## STEP 3 — Onboarding Flow

**Reference:** `Hidden Gems - Onboarding + Paywall.dc.html`

```
Shown after first sign-up (normal source, not deep link)
5 screens in sequence:

1. Intro story screens (4 full-screen slides, swipe to advance)
   Progress dots at top. Skip button top-right.
   Each slide: dark bg, illustration, heading, subtitle

2. Category picker
   "What do you love exploring?" heading
   Grid of category chips (Views, Hidden, Beach, Hiking, Food, Culture, Night, Adventure)
   Select multiple — tapped chips get accent bg, SpaceGrotesk-SemiBold
   Minimum 1 required to continue
   CTA: "Continue →"
   Store selected categories in user profile (used for follow suggestions ranking)

3. Trial offer screen
   Shows Pro features, 7-day free trial CTA
   "Start free trial" → initiate IAP
   "Maybe later" → skip (user can upgrade via paywall later)

4. "You're all set" confirmation
   Compass + teal animation
   "Welcome, Explorer" SpaceMono overline
   CTA: "Start exploring →" → navigate to follow suggestions

5. Follow suggestions (see Step 9.2)
   Ranked by category match from step 2
   4 suggestions, skip available
   "Start exploring →" → Discover, mark onboardingComplete = true
```

---

## STEP 4 — Tab Bar

**Reference:** `Hidden Gems - Final Spec.dc.html` (Col 1 — interactive, tap each tab)

```
5 items: Discover | Map | [Add FAB] | Swipe | Profile

Active tab:
  - 44×32px pill behind icon, background: accentSub
  - Icon: accent colour
  - Label: SpaceMono 9px, accent colour, letterSpacing: 0.5

Inactive tab:
  - No pill background
  - Icon: textTertiary
  - Label: SpaceMono 9px, textTertiary (or omit label for inactive — see design)

Add FAB (centre):
  - 52×52px circle, coral background
  - Icon: + (22px, white, strokeWidth 2.2)
  - marginTop: -14 (floats above the bar line)
  - box shadow: 0 4px 16px rgba(coral, 0.35)
  - NEVER shows active state — always coral regardless of current tab
  - onPress: open AddGem bottom sheet (does not navigate)

Badge (unread):
  - 14px circle, #F87171 (semantic red, same in dark+light)
  - border: 2px theme.background
  - position: absolute, top-right of the active pill area
  - White SpaceMono count inside
  - Shows on: Profile (unread notifications), Swipe (new matches/gems)
  - Max display: "99+" for counts > 99

Tab bar background: theme.background
Border top: 0.5px theme.border

Android: ensure NavigationBar (system) matches theme.background
         expo-navigation-bar setBackgroundColorAsync(theme.background)
```

---

## STEP 5 — Discover Screen

**Reference:** `Hidden Gems Design Review.dc.html` (Col 1)

```
Header:
  "Discover" SpaceGrotesk-Bold 22px (left)
  Search icon button (36px circle, bgTertiary) → opens Global Search modal

Filter chips (horizontal scroll, no scrollbar):
  All | Views | Hidden | Beach | Hiking | Food | Culture | Night | Adventure
  Active: accent bg, accent text, SpaceGrotesk-SemiBold
  Inactive: bgTertiary bg, textSecondary

FlatList of GemCard (full size):
  onEndReachedThreshold={0.3}
  ListFooterComponent={<LoadMore status={...} onRetry={refetch} count={gems.length} />}
  refreshControl={<RefreshControl tintColor={theme.accent} />}

Loading state (initial):
  Show 3 SkeletonCard (full size), staggered shimmer +200ms each, last one at 0.4 opacity

Location denied state:
  Show amber PermissionDeniedBanner at top of screen
  "Location access needed" + "Open Settings" → Linking.openURL('app-settings:')
  Below banner: show globally popular gems (no distance label, "Popular globally" section header)
  Banner disappears automatically when app is foregrounded and location is now granted

Data fetching:
  - When location available: fetch gems sorted by distance (nearest first)
  - When location denied: fetch gems sorted by likeCount desc
  - Paginate: 20 per page, cursor-based
  - Cache: React Query, staleTime: 5 minutes
```

---

## STEP 6 — Map Screen

**Reference:** `Hidden Gems Design Review.dc.html` (Col 6) + `Hidden Gems - Medium Priority Gaps.dc.html` (Col 1 — interactive, tap the 12-cluster)

```
react-native-maps full-screen, dark map style
Status bar: always "light" (dark map bg)
Safe area: floating controls respect useSafeAreaInsets()

Pin types (implement as MapMarker with custom component):
  1 gem:    32px diamond (rotated square), coral bg, border: 2px theme.background
            borderRadius: [16, 16, 4, 16] (top 3 rounded, bottom-left pointed)
  2–3 gems: 36px circle, accentSub bg, accent border 2px, SpaceMono count accent
  4–11 gems:42px circle, accent bg, SpaceMono count #0A1F1C, opacity: 0.9
            + outer ring (border: 1px rgba(accent, 0.25)) at 47px
  12+ gems: 52px circle, accent bg, SpaceMono count #0A1F1C
            + outer ring at 58px
            This is the "large cluster" — most prominent

Cluster tap behaviour:
  1. Close any open sheet
  2. Show floating card (position: absolute, top: 160px, left/right: 20px):
     - "N gems here" SpaceMono overline
     - 3 gem thumbnails (80×80, 10px radius) + "+N" count tile if more
     - "Zoom in to separate pins" → camera.animateCamera({ zoom: +2 })
     - × to close
  Single pin tap:
     Open bottom sheet snap to 30% (peek state, shows gem name + check-in button)
     Drag up to 65% (expanded: description + comments)

Map controls (floating, right side, bottom):
  Location FAB: 44px circle, card bg, shadow
    paddingBottom: insets.bottom + 16 (HOME INDICATOR clearance)
  +/− zoom: 40×40px pills stacked, card bg, 10px radius

Bottom sheet (gem detail on map) snap points: ['30%', '65%']
  30%: gem name, category badge, ♥ count, "Check In" button — map remains interactive behind
  65%: full gem description, comments count, "View full detail" link
```

---

## STEP 7 — Gem Detail

**Reference:** `Hidden Gems Design Review.dc.html` (Col 7) + `Hidden Gems - Missing Screens.dc.html` (Col 5)

```
Stack push transition (horizontal slide, 300ms easeInOut)
Shared element: GemCard image → hero image (Reanimated.SharedTransition, tag: `gemCard_${id}`)

Header (scrolled-away on scroll, collapses to 44px strip):
  Collapsed strip: dark gradient bg, gem name SpaceGrotesk-Bold 14px #EAF6F4, ♥ count SpaceMono 10px
  Full: photo hero, category badge, name, author, ♥ count, save/share buttons

Hero photo:
  Tappable → fullscreen photo viewer (see Step 7.1)
  If multiple photos: dot indicators at bottom of hero

Check-in section (below hero):
  "Check In Here" label, SpaceGrotesk-SemiBold 13px
  Coordinates in SpaceMono 10px textSecondary
  "Check In" button → triggers Step 7.2

Comments section (below check-in):
  "Comments (N)" SpaceMono monoXS overline
  "Most recent" sort toggle (right)
  FlatList of comment rows (avatar, username, timestamp, content, ♥ count, Reply)
  "View all N comments →" link at bottom of preview (shows first 3 comments only)
  "Reply" on a comment row: sets replyTo state → shows reply-to banner above composer

Sticky composer bar (always visible at bottom):
  User avatar (28px, own)
  Input: "Add a comment…" placeholder, bgTertiary, accent border when focused, 36px height
  Send arrow (32px, accent circle)
  KeyboardAvoidingView behavior="padding" wraps the whole screen
  On keyboard open: flatListRef.current.scrollToEnd() after 150ms delay
  Gem header collapses to 44px strip when keyboard is open (saves space)

Reply-to banner (shows between FlatList and composer when replying):
  Teal left border (2px), accentSub bg, 0 8px 8px 0 radius
  "REPLYING TO @username" SpaceMono overline (accent)
  Preview text (first 40 chars of comment)
  × button to cancel reply
```

### 7.1 Fullscreen photo viewer

```
Reference: Hidden Gems - High Priority Gaps.dc.html (Col 2)

Always black background (#000) — ignore theme
Status bar: always style="light"

Top controls (gradient overlay):
  ← back button (36px dark pill, position absolute top-left)
  "N / M" counter (SpaceMono 11px, position absolute top-centre, rgba white 0.7)
  Bookmark + Share icons (36px dark pills, position absolute top-right)

Dot indicator (position absolute, above gem info):
  Inactive: 6px circle, rgba white 0.4
  Active: 18×6px pill, teal (#2DD4BF — always, not theme.accent, since bg is always black)
  Swipe left/right to navigate photos

Bottom gem info (gradient overlay):
  Category badge (same style as GemCard)
  Gem name SpaceGrotesk-Bold 18px #EAF6F4
  "@username · ♥ N" SpaceMono 11px rgba white 0.6
  Tapping gem name → closes viewer + navigates to Gem Detail

Gestures:
  Swipe left/right: navigate photos
  Pinch to zoom: use react-native-reanimated + gesture-handler
  Swipe down: close (velocity-based, > 1000 units/s triggers dismiss)
  Info fades on pinch-zoom active

Library: react-native-image-viewing OR custom Reanimated implementation
```

### 7.2 Check-in confirmation sheet

```
Reference: Hidden Gems - Missing Screens.dc.html (Col 5) — tap "Check In" button

Triggered by: tapping "Check In" on Gem Detail
Pre-requisite: Location permission granted (if not → show PermissionExplain first)

Business logic:
  1. Get current GPS position (expo-location)
  2. Verify user is within 500m of gem coordinates
  3. If too far: show error toast "You need to be at the gem to check in"
  4. If OK: increment checkInCount + 1 server-side, record check-in

Sheet content:
  Compass illustration (64px circle, accent border, teal ring)
  "Checked In" SpaceMono overline (accent)
  Gem name SpaceGrotesk-Bold 22px
  Coordinates in SpaceMono 11px accent
  "Today at {time} · check-in #{N}" SpaceMono 10px textTertiary
  "Share This Check-in" CTA (accent, full-width)
  "Done" text → dismiss sheet + update Check-in button to "✓ Checked In" (muted)

On trigger: hapticSuccess()
Dismiss: swipe down or tap "Done"
```

---

## STEP 8 — Add Gem / Edit Gem

**Reference:** `Hidden Gems Design Review.dc.html` (Col 6) + `Hidden Gems - Remaining Flows.dc.html` (Col 1 + 2)

### Add Gem (bottom sheet, 90% snap)
```
Opened from tab bar FAB or map + button
Bottom sheet snap: 90% (almost full screen)
Android: onRequestClose → confirm dialog if any field has content

Header: × close | "Add Gem" centred | "Post" right (disabled until required fields filled)

Required fields:
  Name (SpaceGrotesk, text input)
  Photo (see 8.1 Photo picker)
  Category chips (single select from 8 options)
  Location (auto-filled from GPS, editable)

Optional:
  Description (multiline, 72px min height)
  Tags

Submission:
  Upload photos first → get URLs
  Submit gem data with status: 'pending' (requires admin approval)
  Show success toast: "Gem submitted for review"
  Close sheet
```

### Edit Gem (modal presentation, not sheet)
```
Accessed from: Gem Detail ··· menu → Edit
Same form as Add Gem but:
  - Pre-filled with existing gem data
  - Header: "Cancel" | "Edit Gem" | "Save"
  - Photo strip shows existing photos (replaceable)
  - Adds Visibility toggle: Public / Friends / Private (segmented, 3 options)
  - Delete gem at bottom (red text link, separated by divider)

Delete:
  1. Red text "Delete this gem" → taps opens confirm bottom sheet
  2. "Delete this gem? This cannot be undone."
  3. Red "Delete" confirm + grey "Cancel"
  4. On confirm: delete API call → navigate back to profile → success toast
```

### 8.1 Photo picker sheet
```
Reference: Hidden Gems - Remaining Flows.dc.html (Col 2 — top screen)

Triggered from: photo tile in Add/Edit Gem form
Bottom sheet, auto snap height

Content:
  "Add photo" title
  Preview strip: existing photos as 80×80 tiles + "+" add tile (dashed border, textTertiary +)
  Max 5 photos — "+" tile disappears when 5 reached

Actions (listed in sheet):
  "Take a photo" → request camera permission → expo-image-picker launchCameraAsync()
  "Choose from library" → expo-image-picker launchImageLibraryAsync({ allowsMultipleSelection: true, selectionLimit: remainingSlots })
  "Remove all photos" → red text, removes all photos from form state

On photo selected:
  Compress to max 2MB (use expo-image-manipulator)
  Show as thumbnail in preview strip
  Order is editable (drag to reorder — optional v1 enhancement)
```

---

## STEP 9 — Profile Screens

**Reference:** `Hidden Gems Design Review.dc.html` (Col 2) + `Hidden Gems - Missing Screens.dc.html` (Col 2) + `Hidden Gems - High Priority Gaps.dc.html` (Col 5 + 6)

### Own profile
```
Cover band: 88px, gradient (not photo in v1)
Avatar: 72px circle, overlaps bottom of cover, accent ring
Name + @username + level badge (accentSub bg, accent border, "LV. N" SpaceMono 9px)
Bio text + location
Stats row (tappable):
  Gems (count) | Followers (count) → /profile/[username]/followers?tab=followers
              | Following (count) → /profile/[username]/followers?tab=following

Gem grid (3 columns):
  "+" tile at position 0 → opens AddGem sheet
  Normal gems: tap → Gem Detail
  Pending gems: amber border + hatch overlay + "UNDER REVIEW" badge + "visible after approval" sub-label
  Rejected gems: red border + hatch overlay + "REJECTED" badge + rejection reason + "Edit + resubmit" link

Unverified email banner (soft, not blocking):
  Below stats row, amber colour
  "Verify your email to post gems · Resend →"
  Only shown until verified, then removed

Settings icon (top right) → /settings
```

### Other user profile
```
Same layout but:
  - "Edit Profile" → "Follow" + "Message" buttons (top right of cover)
  - Follow button:
      Not following: accent bg "+ Follow"
      Following: bgTertiary "Following ✓", tap to unfollow (confirm: "Unfollow @username?")
      Pending (private account): bgTertiary "Requested"
  - Message button: border-only outline
  - No "+" tile in gem grid
  - No edit/delete options on gems (long-press context menu removed)
  - ··· menu (top right): Mute | Block | Report
  - Blocked profile shows generic "This account is not available" screen (no username confirmation)
```

### Follow suggestions (post sign-up)
```
Reference: Hidden Gems - High Priority Gaps.dc.html (Col 6 — interactive, tap Follow buttons)

Shown after: sign-up step 3 (normal source) OR on next open after deep-link source
Skipped if: user has already completed this step (persisted in AsyncStorage)

4 suggestion rows, ranked by:
  1. Shared categories from onboarding picker
  2. Location proximity
  3. Gem count (more = higher)

Each row: avatar + displayName + "@username · N gems" + Follow button
Follow toggle: accent "+" Follow → bgTertiary "Following ✓"

"Start exploring →" CTA: accent, full-width (routes to Discover, marks onboarding complete)
"Skip for now" text link below CTA

Post-follow: hapticSuccess() for each follow action
```

---

## STEP 10 — Social Graph

**Reference:** `Hidden Gems - Missing Screens.dc.html` (Col 3)

```
Route: /profile/[username]/followers
Tab param: ?tab=followers (default) or ?tab=following

Tab bar (Followers | Following):
  Active: accent bg, #0A1F1C text, SpaceGrotesk-SemiBold 13px
  Inactive: bgTertiary bg, textSecondary

Search bar: filter list in real-time (client-side filter on loaded data)

Followers tab — button states per row:
  They follow you, you DON'T follow them: accent "Follow Back" (priority — do this first)
  Mutual (both follow each other): bgTertiary "Following", MUTUAL chip (accentSub, accent border)
  Not yet following: accent "+ Follow"
  Toggling any → hapticSuccess()

Following tab:
  All show bgTertiary "Following" state
  YOUR own row (if viewing own profile): teal-tinted bg, "YOU" badge (accent bg, #0A1F1C)
  Official account: teal "OFFICIAL" badge

Mutual badge: "MUTUAL" in SpaceMono 8px, accentSub bg, accent border, 5px radius
  (same component as "OFFICIAL" and "LV. N" badges — one BadgeChip component, different colours)
```

---

## STEP 11 — Messages + Chat

**Reference:** `Hidden Gems - Missing Screens.dc.html` (Col 1) + `Hidden Gems - Skeletons + Empty States.dc.html` (Col 6)

### Messages inbox
```
Route: /messages

Header: "Messages" SpaceGrotesk-Bold 22px + compose (pencil) icon button

Search bar: filters conversation list client-side

Conversation rows (order: unread first, then by recency):
  Unread: 4 signals simultaneously —
    Teal dot (13px) on avatar (top-right, border: 2px bg)
    Bold (@username) SpaceGrotesk 14px weight 700
    Accent timestamp (SpaceMono 10px)
    Full-brightness message preview (theme.text instead of textSecondary)
    Row bg tinted: rgba(accent, 0.05)
  Read: all muted, normal weight
  Official account: teal "OFFICIAL" badge inline next to name

Message requests section (below main list):
  Section header: "MESSAGE REQUESTS" SpaceMono overline + count badge (accent bg)
  Request rows: 55% opacity, question mark avatar
  Tap section header: expands to show all requests
  Privacy: non-followers' first message is a request, not in main feed

Avatar: UserAvatar component, 48px
Timestamps: SpaceMono 10px — "2m", "1h", "Yesterday", "Mon" etc.
```

### 1:1 Chat
```
Route: /messages/[conversationId]

Header:
  ← back, 34px avatar, @username, "Active now" / "Active Xh ago" sub-label

Message bubbles:
  Own (right): accentSub bg, accent border 0.5px, borderRadius: [14,14,4,14]
  Other (left): card bg, border 0.5px, borderRadius: [14,14,14,4]
  Timestamp inside bubble: SpaceMono 10px textTertiary, right-aligned for own

FlatList inverted:
  inverted={true} (newest at bottom)
  onEndReached: load older messages

Composer bar:
  Own avatar (28px)
  TextInput: bgTertiary bg, accent border on focus, 38px height, borderRadius: 20
  returnKeyType="send" → onSubmitEditing fires send
  Send arrow button: 36px circle, accent bg

KeyboardAvoidingView behavior="padding" wrapping entire screen
Active input: selectionColor={theme.accent} on TextInput

Read receipts: show "Seen" under last own message when read
```

---

## STEP 12 — Communities

**Reference:** `Hidden Gems - Social + Premium.dc.html` (Col 3) + `Hidden Gems - Missing Screens.dc.html` (Col 4) + `Hidden Gems - Remaining Flows.dc.html` (Col 3) + `Hidden Gems - Medium Priority Gaps.dc.html` (Col 3)

### Communities list
```
Route: /communities (accessible from Profile or nav)

Tabs: All | Mine | Nearby
  Mine empty state:
    EmptyState icon="people" title="Find your explorer crew"
    subtitle="Join groups built around the places you love — or start your own."
    cta="Browse Communities" onCta={() => switchTab('all')}
    secondaryCta="create one →" onSecondaryCta={() => router.push('/communities/create')}

  Loading state (All + Nearby tabs):
    4 SkeletonCard rows (58×58px square thumb + 3 text lines, exact CommunityCard shape)

Community card (in list):
  58×58px rounded image/gradient (12px radius)
  Community name SpaceGrotesk-SemiBold 14px
  Description 1 line, textSecondary 12px
  "N members" SpaceMono 10px textTertiary
  "Join" button (outline, right) or "✓ Joined" (muted)
  Creator badge: "CREATOR" chip (if current user is creator)

"+" (create) button top-right → /communities/create
```

### Community Detail
```
Route: /communities/[id]
3 tabs: Feed | Chat | Manage (Manage: creator + moderators only)

Banner header (96px):
  Gradient bg, community name SpaceGrotesk-Bold 17px #EAF6F4
  Member count SpaceMono 10px
  "✓ JOINED" badge (accentSub, accent border) or "Join" button

FEED tab:
  Post types:
    1. Gem-share post: user shares a GemCard → shows embedded GemCard inline (not just a link)
    2. Text post: plain text, author, timestamp

  Reactions: emoji row (🔥 🌊 ❤) — not a generic 👍
    Reaction counts in SpaceMono 10px textSecondary
    REACTION_TYPES constant: ['🔥','🌊','❤','💎','🏔'] — these 5 only
  Reply count link at bottom right

  Pinned post: shown first with "📌 PINNED" badge in bgTertiary pill

CHAT tab:
  Group chat — same bubble pattern as 1:1 chat
  Small avatar (26px) left of other-user bubbles
  Own bubbles right, accentSub + accent border
  returnKeyType="return" (not "send" — multi-line messages possible in group)
  "Message the group…" placeholder

MANAGE tab (creator + mods only):
  Join requests section (with count badge):
    Each row: avatar + @username + "Requested Xh ago · N gems"
    Approve (accent) + Deny (bgTertiary outline) buttons

  Pinned post: current pin shown, "Unpin" button

  Members (count):
    List rows with ··· menu per member:
      "Promote to moderator"
      "Remove from community"
      "Block user"

  Community settings:
    "Edit community info" → edit form (same as creation form, pre-filled)
    "Delete community" → red, confirm sheet with "Type DELETE to confirm"
```

### Community creation
```
Route: /communities/create

Cover preview (120px): renders LIVE from name field (same gradient + text overlay)
  "Change cover" button → photo picker or colour picker (6 preset gradients)
Name field (active, accent border)
Description (multiline)
Type toggle: Open | Invite only
  Open: anyone can join instantly
  Invite only: join button → "Request to join", creator sees join requests in Manage tab
Location tag (optional, text field with 📍 prefix)

CTA "Create community" → creates community, navigates to /communities/[newId]
```

---

## STEP 13 — Gem Swipe

**Reference:** `Hidden Gems - Social + Premium.dc.html` (Col 1) + `Hidden Gems - Skeletons + Empty States.dc.html` (Col 4 + 5)

```
Route: /swipe (Pro gate — non-Pro users see paywall instead)

Card stack:
  3 cards visible simultaneously
  Front (top): scale(1.0) translateY(0) — full opacity
  Middle: scale(0.95) translateY(8) — 60% opacity
  Back: scale(0.90) translateY(16) — 35% opacity

Swipe gestures:
  Right: save gem (hapticMedium), next card
  Left: skip gem, next card
  Up: super-save / send to community

Action buttons (bottom, above home indicator):
  X dismiss: 52px, bgTertiary circle, red × icon
  ❤ save: 64px (LARGER), accent circle, white heart icon → hapticMedium()
  ⭐ super-save: 52px, coral circle, star icon
  paddingBottom: insets.bottom + 10

Loading state (skeleton):
  Same 3-card stack structure, all shimmer gradient
  Staggered animation delays: back=0s, middle=0.2s, front=0.4s
  Action buttons: shimmer circles at same sizes (52/64/52), 0.5/0.7/0.5 opacity
  PRO badge shown (teal/coral)

Empty state:
  Reference: Skeletons + Empty States.dc.html Col 5
  Compass + checkmark icon (teal ✓ replacing centre dot)
  "Area explored" SpaceMono overline (accent)
  "You've seen everything nearby" title
  "9 new gems added in this area this week." body
  "Check back tomorrow →" SpaceMono accent link
  "Expand to 50 km" CTA (accent, full-width) → re-fetch with larger radius
  "Try Trip Planner instead" outline secondary CTA
  "❤ N saved this session" chip at bottom (SpaceMono textSecondary, bgTertiary) — only show if count > 0
```

---

## STEP 14 — Trip Planner

**Reference:** `Hidden Gems - Final Screens.dc.html` (Col 1) + `Hidden Gems - Skeletons + Empty States.dc.html` (Col 3)

```
Route: /trip-planner

Inputs (always visible, even during search):
  Location field: text input with 📍 prefix, auto-suggest as user types
  Radius toggle: 10km | 25km | 50km (segmented, accent = selected)
  Categories: chips (multi-select)

Search button:
  Normal: accent, "Search gems →"
  Searching: bgTertiary, spinner (16px, teal border-top transparent) + "Searching…" label

Results section (appears after first search):
  Section header: "Results near {placeName}" SpaceMono overline
  GemCard list (compact size)
  LoadMore component at bottom
  
Skeleton (during search):
  Section header shows immediately with real search location text
  3 compact GemCard skeletons below
  Third skeleton: opacity 0.5 (fade to signal more)

No results empty state:
  EmptyState icon="compass" title="No gems found nearby"
  subtitle="Try expanding your search radius or choosing different categories"
  cta="Expand to 50 km" (increases radius to next tier)

Trip export sheet (trigger: "Export trip" button on results):
  Reference: Hidden Gems - Remaining Flows.dc.html (Col 5 — trip export panel)
  Options: Share link | Export to Maps | Save as PDF
  Share link: generate hiddengems.app/trip/[id] (public read-only)
  Export to Maps:
    iOS: Universal Link → Apple Maps with waypoints
    Android: Intent → Google Maps with waypoints
  Save as PDF: react-native-print with custom HTML template
```

---

## STEP 15 — Notifications Screen

**Reference:** `Hidden Gems Design Review.dc.html` (Col 3) + `Hidden Gems - System Patterns.dc.html` (Col 3)

```
Route: /notifications
Tab bar badge (Profile tab) clears when this screen is opened

Notification row types:
  nearby_gem: compass pin icon, "N gem Xm away — {name} by @username"
  follow:     user avatar, "@username started following you"
  like:       heart icon, "@username liked your gem {name}"
  comment:    speech bubble icon, "@username commented: {preview}"
  achievement:trophy icon (coral), "Achievement unlocked — {NAME}"
  community:  community icon, "@username joined your community"

Unread rows: slightly tinted bg (rgba accent 0.04)
Timestamp: SpaceMono 10px textTertiary, right-aligned
Tap row → deep links:
  nearby_gem + like + comment: → /gem/[id]
  follow: → /profile/[username]
  achievement: → /profile/[ownUsername] scrolled to achievements
  community: → /communities/[id]

Mark all read: button in header (only shows if any unread)
```

### Push notifications setup
```
Reference: Hidden Gems - System Patterns.dc.html (Col 3)

Expo notifications setup:
  Create 3 notification channels (Android):
    'nearby' - for location-triggered gems
    'social' - follows, likes, comments
    'achievements' - badge unlocks

Permission timing:
  Request push permission AFTER user saves their first gem (highest intent moment)
  Pre-permission explain screen before OS dialog (see Auth Step 2.6)

In-app banner (foreground notification):
  addNotificationReceivedListener → intercept push → show <Toast /> variant
  Same content as push notification text
  4s auto-dismiss
  Tap banner → same deep link as tapping notification

Background tap (app closed/backgrounded):
  addNotificationResponseReceivedListener → read notification.request.content.data
  Navigate to appropriate screen via router.push()

Android notification icon:
  monochrome white compass PNG, 96×96px
  app.json → expo.android.icon (separate from app icon)
```

---

## STEP 16 — Global Search

**Reference:** `Hidden Gems - System Patterns.dc.html` (Col 4)

```
Route: /search (modal, full-screen)
Opened from: Discover header search icon, also accessible anywhere

Layout:
  Active search bar (accent border, accent search icon) + "Cancel" → dismiss modal
  Filter pills: All | Gems | People | Places
  Results list
  Recent searches (shown when bar focused + empty)

Results (mixed types):
  GEM row:    GemCard mini thumbnail (44×44), category badge, name, "♥ N · Location", "GEM" tag
  PERSON row: UserAvatar (44px), displayName, "@username · N followers", "PERSON" tag
  PLACE row:  📍 icon in 44×44 tile, place name, "Country · N gems nearby", "PLACE" tag
  Type tags: SpaceMono 9px textTertiary, right-aligned

Match highlighting:
  Build a HighlightText component that splits text on query string
  Matched portion: accent colour (theme.accent), same font
  Example: "Modra" (query) → <Text accent>Modra</Text><Text> Špilja Cave</Text>

Recent searches:
  Stored in AsyncStorage key: 'recentSearches' (JSON array, max 5)
  Shown as chip pills when search bar focused + empty
  Each chip: bgTertiary, textSecondary text, × to remove
  "Clear all" text link above chips

Search logic:
  Debounce: 300ms after last keystroke
  Minimum 2 characters to trigger
  Rank: match score × social graph proximity (followed users rank higher)
  Filter pills re-filter the current results client-side (no new API call)
```

---

## STEP 17 — Leaderboard

**Reference:** `Hidden Gems - High Priority Gaps.dc.html` (Col 3 — interactive tabs)

```
Route: /leaderboard (accessible from Profile → leaderboard icon or link)

Tabs: This week | All time
  This week: resets Monday 00:00 UTC. Shows weekly gems+checkins+likes.
  All time: cumulative score.

Score formula: (gemCount × 10) + (checkInCount × 5) + (likeCount × 1)
Show formula as a legend at bottom of screen: coloured dots + labels

Top 3 — podium layout:
  1st (centre, tallest): 62px avatar, crown emoji above, gold rank badge, "1"
  2nd (left, medium): 52px avatar, silver rank badge, "2"
  3rd (right, shortest): 52px avatar, bronze rank badge, "3"
  Bars under each: coloured rectangles (accent for 1st, bgTertiary for 2nd+3rd), heights proportional

Ranks 4+: flat list rows
  Rank number: SpaceMono 13px textTertiary, 20px width
  38px avatar + displayName + @username
  Score: SpaceMono 12px textSecondary, right-aligned

"YOU" row:
  Always teal-tinted (accentSub bg)
  "YOU" badge (accent bg, #0A1F1C text, SpaceMono 8px)
  Sticky-pinned at bottom of the list, even if rank 200
  Shows current user's actual rank number

Hide from leaderboard:
  If user has toggled "Show on leaderboards" OFF in Settings → Privacy
  Their row is replaced with "Your ranking is hidden" greyed-out row
```

---

## STEP 18 — Settings

**Reference:** `Hidden Gems - Final Screens.dc.html` (Col 2) + `Hidden Gems - Remaining Flows.dc.html` (Col 4)

### Settings main screen
```
Route: /settings
Grouped list (bgTertiary section headers, card rows)

Account: Edit profile, Change email, Change password
Notifications: → /settings/notifications
Privacy: → /settings/privacy
Appearance: Dark / Light / System (segmented toggle)
Subscription: Shows current plan, "Upgrade to Pro" or "Manage subscription"
Help & Support, About, Rate the App
Sign out (red text, bottom)
Delete account → /settings/account (red, bottom)
```

### Notification preferences
```
Route: /settings/notifications

Sections: Activity | Nearby | Community (bgTertiary separators)
Each row:
  Toggle switch (accent = on)
  Label: SpaceGrotesk 14px
  Sub-label: SpaceMono 10px textTertiary (e.g. "Push + in-app", "In-app only", "Push only")

Rows:
  New followers (Push + in-app) — ON default
  Gem likes (In-app only) — ON default
  Comments on my gems (Push + in-app) — ON default
  New gems within 1km (Push only) — OFF default
  Community activity (Push + in-app) — ON default
```

### Privacy settings
```
Route: /settings/privacy

Private account toggle:
  OFF (default): anyone can follow
  ON: all new followers must be approved (existing followers unaffected)
  Shows confirmation when enabling: "Existing followers won't be affected"

Show on leaderboards toggle: ON default

Blocked accounts → list of blocked users, unblock button per row
Muted accounts → list of muted users, unmute per row
```

### Account deletion
```
Route: /settings/account

Step 1 — Explain what's deleted:
  List: gems, comments, communities, messages
  "This cannot be undone after 30 days"
  "Continue" → Step 2

Step 2 — Type to confirm:
  Input: type "DELETE" exactly
  CTA disabled until text matches exactly
  "Delete my account" → red, CTA

Step 3 — Recovery window:
  "Account deactivated"
  "You have 30 days to change your mind"
  "Reactivate account →" link (sends email with reactivation link)
  "Close app" button

Server behaviour:
  Immediate: account deactivated (not visible to others, can't log in)
  After 30 days: permanent deletion scheduled job
  Reactivation: valid for 30 days, re-enables account immediately
```

---

## STEP 19 — Block + Mute

**Reference:** `Hidden Gems - Medium Priority Gaps.dc.html` (Col 2)

```
Triggered from: ··· menu on other user profile, or long-press on a message

Block:
  Bidirectional: both users cannot see each other
  Blocked user viewing blocker's profile: generic "This account is not available" screen
    - No avatar shown (X icon in circle)
    - No gem grid
    - No follow/message buttons
  Blocked user's gems: removed from Discover, Map, Search for the blocker
  Existing DMs: archived, no new messages possible
  Reversible: Settings → Privacy → Blocked accounts → Unblock

Mute:
  Invisible to muted user (they don't know they're muted)
  Muted user's gems in Discover: collapsed to a single row
    Format: dimmed GemCard mini tile + "Hidden gem by @username" + "Muted · Unmute"
    User can expand to see it (tap "Unmute" or expand)
  Muted user's posts in communities: same collapse pattern
  Reversible: Settings → Privacy → Muted accounts → Unmute

Action sheet (from ··· menu):
  "Mute @username" (SVG: crossed-out circle, textSecondary)
  "Block @username" (SVG: × circle, red #F87171)
  "Report" (SVG: !, textSecondary)
  "Cancel" (× icon, textSecondary)
```

---

## STEP 20 — Report Flow

**Reference:** `Hidden Gems - Remaining Flows.dc.html` (Col 2 — bottom screen)

```
Triggered from:
  Gem ··· menu → Report gem
  Comment long-press → Report comment
  User ··· menu → Report user

Bottom sheet, auto height:
  Title: "Report {gem/comment/user}" SpaceGrotesk-Bold 16px
  Subtitle: "What's wrong with this {gem/comment/account}?"

Radio list (one selection required):
  Gem: "It doesn't exist / wrong location" | "Spam or commercial" | "Inappropriate content" | "Other"
  Comment: "Spam" | "Harassment" | "Misinformation" | "Inappropriate" | "Other"
  User: "Spam account" | "Harassment" | "Impersonation" | "Inappropriate content" | "Other"

Active radio: accent filled circle (18px)
Inactive radio: empty circle, border (18px)

Submit button: #F87171 (red) — this is a destructive/negative action
  Enabled once a reason is selected

Post-submit:
  Dismiss sheet
  Success toast: "Report submitted — we'll review it within 24 hours"
  If reporting a user: offer to also block them (secondary CTA in toast)
```

---

## STEP 21 — Error States + Toasts

**Reference:** `Hidden Gems - System Patterns.dc.html` (Col 1)

```
See STEP 1.3 <Toast /> component for implementation.

4 toast types:
  success: teal left border, ticked circle icon, teal icon bg (rgba accent 0.15)
  error:   #F87171 left border, ! circle icon, red icon bg (rgba error 0.12), auto-dismiss=false, includes Retry button
  warning: #FBBF24 left border, △ icon, amber icon bg
  info:    accent left border, ⓘ icon, accentSub icon bg

Offline state (separate from toasts):
  Persistent amber banner (#FBBF24 bg, black text), appears below status bar
  "You're offline — browsing cached gems ×"
  Monitor: NetInfo.addEventListener → show on disconnect, hide on reconnect
  Cached content: React Query's staleTime handles this automatically

Inline field errors:
  Red border (1.5px #F87171) on the offending input
  5px red dot + SpaceMono 10px #F87171 below the input
  Error text examples: "Incorrect email or password", "Username already taken", "Photo too large · max 10MB"
  Clear: onChangeText → setError(null)

Full-screen network error (no data at all):
  WiFi-crossed icon (56px, bgTertiary circle)
  "Can't load gems" SpaceGrotesk-Bold 15px
  "Check your connection and try again" subtitle
  "Try Again" CTA → retry API call
  Only show when: FlatList is empty AND fetch failed (not for load-more errors)

Billing failure:
  Red banner on Profile tab header (persistent)
  Modal on next app open (shown once per 24h until resolved)
  "Payment failed — Update your payment" red modal sheet
  Grace period: 3 days from billing failure
  After 3 days: Pro features gated (Swipe + Trip Planner show paywall)
  "Update payment" → platform IAP management (no custom UI)
```

---

## STEP 22 — Navigation Transitions

**Reference:** `Hidden Gems - System Patterns.dc.html` (Col 2)

```
Stack push: horizontal slide, 300ms, easeInOut
  All screen-to-screen navigations

Modal: spring, damping: 24, stiffness: 200, slides up from bottom
  Bottom sheets, search modal, community create

Tab switch: crossfade ONLY — NEVER slide
  200ms easeInOut opacity crossfade
  Tab switching is peer-to-peer, not sequential — sliding implies order

Shared element (gem card → detail):
  react-native-reanimated SharedTransition
  Tag: `gemCard_${gem.id}` on both the GemCard image AND the GemDetail hero image
  Duration: 350ms
  Cover image + title animate as one unit
  Category badge + metadata animate in separately after arrival (fade in, 200ms, after 150ms delay)

Reduce motion (accessibility):
  const [reduceMotion] = await AccessibilityInfo.isReduceMotionEnabled()
  If true:
    All transitions → crossfade only (no slides, no shared elements, no spring)
    Duration: 150ms max
    Haptics: unchanged (haptics are not motion)
```

---

## STEP 23 — Permission Flows

**Reference:** `Hidden Gems - Auth + Permission Flows.dc.html` (Col 5) + `Hidden Gems - High Priority Gaps.dc.html` (Col 4)

### Permission request timing
```
Location: On first Discover load (not at install)
Camera: On first tap of photo slot in Add Gem
Notifications: After first gem saved (highest-intent moment)
NEVER: request multiple permissions at launch, never stack requests
```

### Pre-permission explain screen (always before OS dialog)
```
Same layout for all 3 permissions:
  88px icon circle (bgTertiary bg, 12px accentSub ring)
  SpaceMono monoXS overline (accent): "{Permission type} access"
  SpaceGrotesk-Bold 22px title: "Find gems near you" / "Add photos to your gem" / "Get notified of hidden gems nearby"
  SpaceGrotesk 13px subtitle: explains why + privacy note
  Primary CTA: accent, "Allow Location" / "Allow Camera" / "Allow Notifications" → triggers OS dialog
  "Not now" text link

After "Allow" CTA:
  OS dialog appears
  If granted → proceed with original action
  If denied → show PermissionDeniedBanner (below)

Camera:    coral accent on this screen (not teal)
Location:  teal accent
Notifications: teal accent
```

### Permission denied recovery
```
Reference: Hidden Gems - High Priority Gaps.dc.html (Col 4)

Location denied (in Discover):
  Amber banner (warning style) pinned below search bar:
    ⚠ "Location access needed"
    "To find gems near you, enable location in Settings."
    "Open Settings →" (accent pill) → Linking.openURL('app-settings:')
    × to dismiss (temporarily — re-appears next session)
  Below banner: globally popular gems, "Popular globally" section header
  No distance shown on any gem card while denied

Camera denied (in Add Gem photo slot):
  Amber banner replaces the photo drop zone:
    "Camera access needed — Open Settings to re-enable"
    "Open Settings" CTA
  Library option still available (may work without camera permission)

Notifications denied (on Profile):
  Soft amber banner below profile stats:
    "Enable notifications to discover nearby gems"
    "Open Settings →"
  Dismissible, not shown again for 7 days after dismiss

On app foreground (AppState change):
  Re-check all permissions silently
  If now granted: hide the corresponding banner automatically
```

---

## STEP 24 — Deferred Deep Link

**Reference:** `Hidden Gems - Medium Priority Gaps.dc.html` (Col 5)

```
Full flow:

1. Web landing page (hiddengems.app/gem/[id]):
   Server-rendered: gem photo, name, coordinates
   Smart app banner: "Hidden Gems — Free · App Store" + "Get" button
   "Get" encodes gemId in Branch.io / Firebase Dynamic Links

2. User installs app via the banner link

3. App first launch:
   Branch.io SDK reads deferred payload on first open
   If gemId found: authStore.pendingDeepLinkGemId = gemId

4. Auth gate:
   User is new → show abbreviated sign-up (Step 2.6)
   User already has account → direct to gem after sign-in

5. Post sign-up abbreviated screen:
   "BROUGHT YOU HERE" teal banner (accentSub, accent border, 12px radius)
   Pin icon + gem name + "You'll see this gem after signing up"
   SSO shown FIRST (fastest path)
   CTA: "Sign up + see gem →"

6. After account creation:
   Skip category picker + follow suggestions
   Navigate directly → /gem/[pendingDeepLinkGemId]
   authStore.onboardingSource = 'deep_link'
   Clear pendingDeepLinkGemId

7. On NEXT app open (user returns):
   Show category picker first
   Then follow suggestions
   Then mark onboarding complete

Branch.io setup:
  Call Branch.subscribe() in app/_layout.tsx to listen for deferred links
  Also call Branch.getLatestReferringParams() on first open (async, may be delayed)
```

---

## STEP 25 — Brand Assets

**Reference:** `Hidden Gems - Brand Assets.dc.html`

### App icon
```
File: assets/icon.png
Size: 1024×1024px, flat square (no rounded corners — OS applies mask)
Design: compass SVG on #0B1A1C background
  Outer circle: 340px diameter, stroke #2DD4BF 1.8px
  N needle (top): stroke #FF9F5A 3px, linecap round
  S needle (bottom): stroke #2DD4BF 3px, linecap round
  E/W needles: stroke #2DD4BF 3px, linecap round
  Centre dot: 55px, fill #2DD4BF

app.json:
  expo.icon: "./assets/icon.png"
  expo.android.adaptiveIcon.foregroundImage: "./assets/adaptive-icon.png"
  expo.android.adaptiveIcon.backgroundColor: "#0B1A1C"

Android adaptive icon (assets/adaptive-icon.png):
  1024×1024px, compass centred in middle 66% (safe zone for all crop shapes)
  Background is transparent (backgroundColor set in app.json)

Android notification icon (assets/notification-icon.png):
  96×96px, monochrome (white compass on transparent)
  app.json → expo.android.icon: "./assets/notification-icon.png"
```

### Splash screen
```
File: assets/splash.png
Design: compass SVG centred on #0B1A1C, same dimensions as icon compass at 200px

app.json:
  expo.splash.image: "./assets/splash.png"
  expo.splash.resizeMode: "contain"
  expo.splash.backgroundColor: "#0B1A1C"

Hold splash until:
  Fonts loaded
  Auth token validated
  Initial route determined
Use SplashScreen.preventAutoHideAsync() + SplashScreen.hideAsync() in _layout.tsx
```

### Achievement badges
```
Reference: Hidden Gems - Brand Assets.dc.html (Col 3)

8 SVG badges — implement as inline SVG components in AchievementBadge.tsx
All badges: circular bg (dark gradient), coloured icon, circular border

Teal badges (activity/exploration):
  Pioneer:     diamond outline (square rotated 45°)
  Navigator:   compass ring with tick marks
  Pathfinder:  compass needle (coral N, teal S), diamond needle shape
  Trailblazer: mountain peak lines
  Secret Find: eye/iris (oval with inner circle)

Coral badges (identity/social):
  Local Legend: two person figures (one full, one partial behind)
  Founding:     5-point star outline
  Connector:    two person figures + plus icon

Trigger conditions:
  Pioneer:      first gem approved
  Navigator:    10th check-in (cumulative)
  Pathfinder:   50th check-in
  Trailblazer:  25th approved gem
  Local Legend: 5 approved gems within same 10km radius
  Founding:     account created before [launch_date + 6 months]
  Secret Find:  check-in on a gem with < 3 previous check-ins
  Connector:    member of 3 or more communities

All checked server-side after relevant action completes
Push achievement notification + in-app AchievementUnlock sheet
```

### OG share image
```
Server endpoint: /api/og?gemId=[id]
Built with @vercel/og (Satori)
Size: 1200×630px

Layout (see Brand Assets design file):
  Left column (214px, full height): gem photo (cover-fill) + gradient overlay + category badge + check-in count
  Right column (flex 1, #0B1A1C): app logo row + category+location badge + gem name (large) + coords + attribution + CTA button

Fonts: fetch Space Grotesk + Space Mono from Google Fonts as ArrayBuffer for Satori

Deep link: hiddengems://gem/[id]
Fallback (not installed): https://hiddengems.app/gem/[id] (web landing page)

og:image meta tag in web landing page: /api/og?gemId=[id]
twitter:card: summary_large_image
```

---

## STEP 26 — Admin Panel

**Reference:** `Hidden Gems - Final Screens.dc.html` (Col 3)

```
Visibility: ONLY shown to users where user.isAdmin === true
Access: Settings → "Admin Panel" row (only shown to admins)
Route: /admin (guarded route, redirect non-admins to Settings)

Sections:
  Gem Review:
    List of pending gems (status: 'pending')
    Each row: gem thumbnail, name, @author, "Xh ago"
    Approve button (accent) + Reject button (red)
    Reject: opens bottom sheet with reason input (required)
    Approval → gem.status = 'approved', triggers push to author "Your gem was approved!"
    Rejection → gem.status = 'rejected', stores reason, triggers push to author with reason

  User Management:
    Search by username
    View user: flag account, ban (soft delete), verify email manually

  Reports Queue:
    List of unresolved reports
    Each: reported item preview, reason, reporter, timestamp
    Actions: Dismiss (false report) | Act (remove content + warn user)

  Stats (read-only):
    Total gems, total users, gems pending review, new signups today
```

---

## STEP 27 — Haptics Reference

Use `expo-haptics` for ALL interactions listed below.

```ts
import * as Haptics from 'expo-haptics';

const hapticLight   = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const hapticMedium  = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
const hapticError   = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
```

| Action | Haptic |
|---|---|
| Gem Swipe save (❤ button) | `hapticMedium` |
| Gem Swipe dismiss (✕ button) | `hapticLight` |
| Check-in confirmed | `hapticSuccess` |
| Achievement unlocked | `hapticSuccess` |
| Follow request accepted | `hapticSuccess` |
| Community joined | `hapticSuccess` |
| Trial/subscription started | `hapticSuccess` |
| Toast dismissed (swipe up) | `hapticMedium` |
| Error toast appears | `hapticError` |
| Form submit error (inline) | `hapticError` |
| Long-press on gem card | `hapticLight` |

---

## STEP 28 — Platform-Specific Fixes (ALL REQUIRED)

### iOS

```ts
// 1. Dynamic Island — NEVER hardcode insets
const insets = useSafeAreaInsets();
// Map FAB: paddingBottom: insets.bottom + 16
// Floating map controls: top: insets.top + 8
// Gem Swipe action bar: paddingBottom: insets.bottom + 10

// 2. Status bar style per screen
// Dark bg screens (map, photo viewer, onboarding, gem detail hero):
<StatusBar style="light" />
// Light mode screens:
<StatusBar style="dark" />
// Use "auto" for theme-adaptive screens

// 3. Bottom sheet (react-native-maps interaction)
overScrollMode="never"
handleComponent={CustomHandle}  // render your 36×4 teal pill
activeOffsetY={[-1, 1]}         // prevents scroll conflict

// 4. KeyboardAvoidingView
// Screens needing it: Auth, Add Gem, Chat, Trip Planner, Gem Detail Comments
behavior="padding"
keyboardVerticalOffset={headerHeight}  // measure actual header

// 5. textContentType for Password AutoFill / Keychain
// Sign-in email: textContentType="emailAddress"
// Sign-in password: textContentType="password"
// Sign-up password: textContentType="newPassword"
// Sign-up email: textContentType="emailAddress"

// 6. Reduce motion
const isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
// If true: all Reanimated transitions → simple opacity, 150ms
```

### Android

```ts
// 1. Status bar background — set in app/_layout.tsx globally
<StatusBar backgroundColor={theme.background} barStyle="light-content" translucent={false} />
// Override per screen where background differs

// 2. System navigation bar
import * as NavigationBar from 'expo-navigation-bar';
// In ThemeProvider on mount and on theme change:
NavigationBar.setBackgroundColorAsync(theme.background);
NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');

// 3. All modals MUST have onRequestClose (hardware back button)
<Modal onRequestClose={handleClose}>
// Add Gem specifically: if form is dirty, show confirm dialog first
// Paywall: dismiss without action
// Achievement sheet: dismiss

// 4. Cards: ALWAYS add elevation alongside iOS shadow
{
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,  // ← THIS IS THE ANDROID SHADOW. Without it, cards are completely flat.
}

// 5. ALL tappable rows and CTAs: use Pressable + android_ripple
// Never TouchableOpacity for primary interactions
<Pressable
  android_ripple={{ color: theme.accentSub, borderless: false }}
  onPress={handler}
>

// 6. Back gesture on Gem Swipe:
// Hardware back during swipe → dismiss current card (same as left swipe)
// Implement via useFocusEffect + BackHandler

// 7. Deferred deep links:
// Firebase Dynamic Links works better than Branch on Android for cold-start deep links
// Test on real device — Android emulator deep link behaviour differs
```

---

## STEP 29 — WCAG + Touch Target Compliance

### Contrast failures (light mode)
```
FAIL: theme.accent (#0F9488) on theme.background (#F7FAF9) at font-size ≤ 11px
  Ratio: 3.8:1 (needs 4.5:1 for normal text)
  Affected: SpaceMono overlines, category overlines on gem cards, coord labels, timestamp labels
  FIX: Use theme.textSecondary (#5B7472, ratio 5.1:1) for ALL SpaceMono text ≤ 11px

PASS: theme.accent on theme.background at ≥ 12px (3.8:1 passes for large text)
PASS: theme.textSecondary (#5B7472) on #F7FAF9 = 5.1:1 ✓
PASS: theme.text (#0B1A1C) on #FFFFFF = 19:1 ✓
PASS: all dark mode colours (dark bg + light text = high contrast)
```

### Touch targets
```
Minimum: 44×44pt on ALL interactive elements

Items needing hitSlop:
  Comment ❤ and Reply actions (~30px visual):
    hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}

Items that are decorative (not tap targets):
  Notification unread dot (6×6px) — the ROW is the tap target (48px height)
  Do NOT add onPress to the dot itself

Items already 44pt+:
  Tab bar items (44×44 pill) ✓
  Map back button (44×44) ✓
  Gem Swipe action buttons (52/64/52px) ✓
  All CTA buttons (50px height) ✓
```

---

## STEP 30 — Rate App Prompt

**Reference:** `Hidden Gems - Remaining Flows.dc.html` (Col 5 — rate app panel)

```
Trigger conditions (ALL must be true):
  1. User has saved ≥ 5 gems total
  2. App installed ≥ 3 days ago
  3. User has never been shown the prompt before (AsyncStorage flag)
  4. Not shown in the last 6 months (AsyncStorage timestamp)

Implementation:
  iOS: expo-store-review (SKStoreReviewRequest — OS controls actual display)
  Android: in-app review API via expo-store-review

Do NOT show custom UI before the OS prompt — just trigger requestReview() directly.
The emoji + star display in the design file is shown as context for where/why it's triggered,
but the actual rating UI is the native OS dialog.

After triggered: store timestamp + 'shown: true' in AsyncStorage
```

---

## Recommended Implementation Order (7 weeks)

```
WEEK 1 — Foundation
  □ Project structure setup (all folders from Section 5)
  □ Install all packages
  □ lib/theme.ts, lib/typography.ts, lib/spacing.ts
  □ ThemeProvider + useTheme() hook, dark/light toggle, system preference
  □ Font loading (Space Grotesk + Space Mono) — app waits until fonts ready
  □ Safe area setup — useSafeAreaInsets() everywhere, never hardcode
  □ Android: NavigationBar colour, StatusBar colour (global)
  □ Shared components: GemCard, UserAvatar, Toast (with store), BottomSheet,
      LoadMore, EmptyState, SkeletonCard, AchievementBadge, HapticPressable
  □ Tab bar (5 tabs, FAB, active pill, badges)
  □ Root _layout.tsx (all providers)

WEEK 2 — Auth + Onboarding
  □ Sign-in screen (with inline error, SE keyboard check)
  □ Sign-up step 1: credentials + password strength bar
  □ Sign-up step 2: username + real-time availability + suggestions
  □ Sign-up step 3: profile photo + camera permission flow
  □ Forgot password (both states, countdown timer)
  □ Email verification (both states, countdown timer, Universal Link handling)
  □ Pre-permission screens (Location, Camera, Notifications)
  □ Permission denied recovery banners
  □ Onboarding: story screens, category picker, trial offer, you're all set
  □ Follow suggestions screen (post sign-up)
  □ App launch logic (token check, deep link detection, routing)

WEEK 3 — Core Screens
  □ Discover (FlatList, skeleton, empty/denied states, pull-to-refresh, load-more)
  □ Gem Detail (hero, shared element transition, all sections)
  □ Fullscreen photo viewer (gestures, indicators, controls)
  □ Check-in confirmation sheet (GPS check, haptic, share CTA)
  □ Add Gem bottom sheet (form, photo picker, submission flow)
  □ Edit Gem modal (pre-filled, visibility toggle, delete with confirm)
  □ Map (clustering, pin types, bottom sheet, floating controls)

WEEK 4 — Social
  □ Own profile (gem grid, pending/rejected states, unverified banner)
  □ Other user profile (follow/message, read-only grid, ··· menu)
  □ Followers/Following list (3 button states, mutual badge, YOU row)
  □ Messages inbox (unread signals, requests section, official badge)
  □ 1:1 Chat (bubbles, keyboard avoiding, returnKeyType="send")
  □ Global Search (modal, filter pills, highlighting, recent searches)
  □ Block + Mute (action sheet, resulting states, Settings management)
  □ Report flow (bottom sheet, reason list, red submit)

WEEK 5 — Communities + Pro Features
  □ Communities list (3 tabs, skeleton, empty state)
  □ Community Detail (Feed + Chat + Manage tabs)
  □ Community creation (live preview, open/invite toggle)
  □ Community moderation (join requests, pin post, member actions)
  □ Gem Swipe (card stack, swipe gestures, skeleton, empty state)
  □ Trip Planner (search, skeleton, results, export sheet)
  □ Leaderboard (podium, flat list, YOU row, formula legend)
  □ Paywall (from Onboarding + Paywall design file)

WEEK 6 — System Layer
  □ Notifications screen (all row types, read state, deep links)
  □ Push notification setup (3 channels, in-app banner, tap handling)
  □ Settings: main screen, notification prefs, privacy, account deletion
  □ Toast system (all 4 types, offline banner, inline errors)
  □ Navigation transitions (stack push, modal spring, crossfade, shared element)
  □ Reduce motion support
  □ Deferred deep link flow (Branch.io, abbreviated sign-up)
  □ Email verification Universal Link handling
  □ All iOS platform fixes (insets, status bar, bottom sheet, KAV)
  □ All Android platform fixes (status bar bg, nav bar, onRequestClose, elevation, ripple)
  □ All haptics (every action in the haptics reference table)

WEEK 7 — Brand, Admin + Polish
  □ App icon (1024×1024, adaptive icon, notification icon)
  □ Splash screen (hold until ready, SplashScreen API)
  □ OG image API endpoint (Satori, all font loading)
  □ Achievement badges (all 8 SVGs, locked state, unlock animation)
  □ Achievement trigger logic (server-side checks, push notifications)
  □ Admin panel (gem review queue, reports queue)
  □ Rate app prompt (trigger conditions, AsyncStorage flags)
  □ Billing failure state (banner, modal, grace period)
  □ WCAG fix: swap accent→textSecondary on SpaceMono ≤ 11px (light mode)
  □ Touch target hitSlop on comment actions
  □ Final design QA pass against all 13 design files
```

---

## Files in This Package

```
design_handoff/
├── README.md                                         ← This file
├── Hidden Gems Design Review.dc.html
├── Hidden Gems - Onboarding + Paywall.dc.html
├── Hidden Gems - Social + Premium.dc.html
├── Hidden Gems - Final Screens.dc.html
├── Hidden Gems - Missing Screens.dc.html
├── Hidden Gems - Brand Assets.dc.html
├── Hidden Gems - Skeletons + Empty States.dc.html
├── Hidden Gems - System Patterns.dc.html
├── Hidden Gems - Final Spec.dc.html
├── Hidden Gems - Auth + Permission Flows.dc.html
├── Hidden Gems - Remaining Flows.dc.html
├── Hidden Gems - High Priority Gaps.dc.html
└── Hidden Gems - Medium Priority Gaps.dc.html
```

Open each `.dc.html` file in any modern browser. Toggle dark/light mode with the button top-right on every file. Tap all interactive elements to see state changes before implementing.

---

*Handoff prepared June 2026. 30 implementation steps, 13 design files, 50+ screens, full system coverage. Implement tokens and shared components first — everything else assembles from them.*
