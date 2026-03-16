# SimplifiED - Mobile Testing Checklist

## Quick Mobile Testing Guide

### Testing on iOS (iPhone/iPad)
1. **Open Safari** on your iOS device
2. **Enter**: `http://your-computer-ip:5173` (replace with your IP)
   - Find IP: Run `ipconfig` on Windows, look for IPv4 address
3. **Test each page**:
   - [ ] Landing page loads smoothly
   - [ ] Navbar hamburger menu works
   - [ ] Theme toggle works
   - [ ] "Get Started" button navigates
   - [ ] Login/Signup forms responsive
   - [ ] Dashboard buttons are tappable
   - [ ] Recording works smoothly
   - [ ] Tab switching works
   - [ ] Text-to-speech functions
   - [ ] Dyslexic mode toggle works

### Testing on Android (Phone/Tablet)
1. **Open Chrome** on your Android device
2. **Enter**: `http://your-computer-ip:5173`
3. **Grant permissions**:
   - [ ] Microphone access requested
   - [ ] Microphone permission granted
4. **Test same items as iOS**
5. **Specific Android tests**:
   - [ ] Chrome address bar doesn't obstruct content
   - [ ] Keyboard doesn't zoom inputs
   - [ ] Swipe navigation works
   - [ ] Buttons have good haptic feedback

### Desktop Testing (Chrome DevTools)
1. **Open your website** in Chrome
2. **Press F12** to open DevTools
3. **Click device icon** (Ctrl+Shift+M) for responsive mode
4. **Test different sizes**:
   - [ ] iPhone SE (375px)
   - [ ] iPhone 12/13/14 (390px)
   - [ ] Galaxy S21 (360px)
   - [ ] iPad (768px)
   - [ ] iPad Pro (1024px)
   - [ ] Desktop (1280px+)

### Specific Responsive Features to Test

#### 1. Navbar
- [ ] Logo size appropriate on mobile
- [ ] Navigation links hidden on mobile
- [ ] Hamburger menu visible on mobile
- [ ] Menu closes after clicking link
- [ ] Theme toggle button visible and works

#### 2. Dashboard
- [ ] Stats cards stack to 2 cols on tablet, 3 on desktop
- [ ] Action cards centered and tappable
- [ ] "Dyslexic User" button text fits
- [ ] Recent lectures grid responsive
- [ ] No horizontal scrolling

#### 3. LecturePage
- [ ] Audio recorder and tabs stack vertically on mobile
- [ ] Recording button is easy to tap
- [ ] Tab text hides on mobile (icons only)
- [ ] Tab content scrolls properly
- [ ] Delete button visible and accessible

#### 4. AudioRecorder
- [ ] Record button size: 96px on mobile, 128px on desktop
- [ ] Duration timer visible and readable
- [ ] Status indicators responsive
- [ ] Waveform animation smooth
- [ ] No button overlaps

#### 5. Forms (Login/Signup)
- [ ] Inputs don't zoom on focus (iOS)
- [ ] Keyboard doesn't cover submit button
- [ ] Spacing good for thumb interaction
- [ ] Error messages readable
- [ ] Links formatted properly

### Performance Testing

#### On Slow Network
1. **Chrome DevTools** → Network tab
2. **Throttle to**: "Slow 4G"
3. **Test**:
   - [ ] Page loads (not blank)
   - [ ] Buttons responsive
   - [ ] Images load quickly
   - [ ] No layout shift (CLS)

#### On Lower-End Device
1. **Test on mid-range Android** if available
2. **Check**:
   - [ ] Animations smooth
   - [ ] No stuttering
   - [ ] Touch response immediate
   - [ ] Memory usage reasonable

### Accessibility Testing (Mobile)

#### Screen Reader (iOS)
1. **Settings** → Accessibility → VoiceOver → On
2. **Test**:
   - [ ] All buttons read correctly
   - [ ] Navigation menu accessible
   - [ ] Links distinguish properly
   - [ ] Form labels clear

#### Screen Reader (Android)
1. **Settings** → Accessibility → TalkBack → On
2. **Same tests as iOS**

#### Dyslexic Mode
1. **Open Dashboard**
2. **Toggle "Dyslexic User"**
3. **Check**:
   - [ ] Font changed globally
   - [ ] Text more readable
   - [ ] Persists on page reload
   - [ ] Works on all pages

### Touch & Interaction Testing

- [ ] All buttons are **minimum 48x48px**
- [ ] Touch response is **immediate**
- [ ] No "ghost taps" (double-triggering)
- [ ] Tap target spacing adequate
- [ ] No tap highlight color (cleaned up)
- [ ] Swipe interactions work (if any)
- [ ] Long-press works (if applicable)

### Network Testing

#### Offline Mode (Chrome DevTools)
1. DevTools → Network → Throttling → Offline
2. **Test**:
   - [ ] Shows graceful error message
   - [ ] UI doesn't crash
   - [ ] Recover when back online

#### WiFi to Mobile Data
- [ ] Smooth transition without reload
- [ ] No data loss
- [ ] Reconnect automatic

### Orientation Testing

#### Portrait Mode
- [ ] All content visible
- [ ] Buttons accessible
- [ ] No horizontal scroll
- [ ] Text readable

#### Landscape Mode
- [ ] Layout adapts (if implemented)
- [ ] Content doesn't overflow
- [ ] Buttons still accessible
- [ ] Navigation visible

### Issue Reporting Template

```
Device: [iPhone 13 / Galaxy S21 / iPad etc]
OS: [iOS 16 / Android 13 etc]
Browser: [Safari / Chrome etc]
Screen Size: [390x844 etc]
Network: [WiFi / 4G etc]

Issue:
- What happened?
- What should happen?
- Steps to reproduce:
  1.
  2.
  3.

Screenshot: [attach if possible]
```

## Quick Test Endpoints

- **Landing**: `/`
- **Dashboard**: `/dashboard` (login required)
- **New Lecture**: `/lecture` (login required)
- **Login**: `/login`
- **Signup**: `/signup`
- **About**: `/about`

## Performance Targets

- **First Contentful Paint (FCP)**: < 2s on 4G
- **Largest Contentful Paint (LCP)**: < 3s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Touch Response**: < 100ms

## Useful Browser Extensions for Testing

- **Responsively App** (Chrome) - Simultaneous multi-device preview
- **Mobile Simulator** (Chrome) - Better mobile simulation
- **UserWay** - Accessibility testing
- **Lighthouse** - Performance & accessibility audits

## Notes
✅ All responsive changes implemented
✅ Touch targets optimized (48px+ minimum)
✅ Meta tags updated for mobile
✅ CSS optimized for mobile rendering
✅ No horizontal scroll issues
✅ Keyboard handling improved

Ready for iOS and Android users! 🎉
