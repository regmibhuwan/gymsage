# Quick Start: Getting GymSage in App Stores

Follow these steps to publish GymSage to iOS App Store and/or Google Play Store.

## Prerequisites Checklist

### For iOS App Store:
- [ ] Mac computer (required - iOS can't build on Windows)
- [ ] Apple Developer Account ($99/year) - Sign up at https://developer.apple.com/programs/
- [ ] Xcode installed (from Mac App Store)
- [ ] CocoaPods installed: `sudo gem install cocoapods`

### For Google Play Store:
- [ ] Android Studio installed - Download from https://developer.android.com/studio
- [ ] Google Play Developer Account ($25 one-time) - Sign up at https://play.google.com/console/signup
- [ ] Java JDK 11+ installed

---

## Step 1: Add Mobile Platforms

### For Android (Can do on Windows/Mac/Linux):
```bash
cd frontend
npm run build
npm run cap:add:android
```

### For iOS (Mac Only):
```bash
cd frontend
npm run build
npm run cap:add:ios
```

This creates the native project folders.

---

## Step 2: Configure Native Apps

### Android Configuration:
1. Open Android Studio
2. File > Open > Navigate to `frontend/android`
3. Wait for Gradle sync to finish
4. Open `app/build.gradle` (Module: app)
5. Update these values:
   ```gradle
   applicationId "com.gymsage.app"
   versionCode 1
   versionName "1.0.0"
   minSdkVersion 22
   targetSdkVersion 33
   ```

### iOS Configuration (Mac Only):
1. Open Xcode
2. File > Open > Navigate to `frontend/ios/App/App.xcworkspace`
3. Select project in navigator > Select "App" target
4. General tab:
   - Display Name: "GymSage"
   - Bundle Identifier: "com.gymsage.app"
5. Signing & Capabilities:
   - Select your Apple Developer Team
   - Enable "Automatically manage signing"

---

## Step 3: Prepare App Icons

### Android Icons:
1. Create icons in these sizes:
   - `mipmap-mdpi/ic_launcher.png`: 48x48
   - `mipmap-hdpi/ic_launcher.png`: 72x72
   - `mipmap-xhdpi/ic_launcher.png`: 96x96
   - `mipmap-xxhdpi/ic_launcher.png`: 144x144
   - `mipmap-xxxhdpi/ic_launcher.png`: 192x192
2. Use online tool: https://www.appicon.co/ or Android Studio's Image Asset tool
3. Place in: `frontend/android/app/src/main/res/mipmap-*/`

### iOS Icons:
1. Need 1024x1024 icon (PNG, no transparency)
2. In Xcode: Assets.xcassets > AppIcon
3. Drag your icon image

---

## Step 4: Test Your App

### Android Testing:
1. Connect Android phone via USB
2. Enable Developer Options and USB Debugging
3. In Android Studio: Run > Run 'app'
4. Test all features (login, workouts, photos, AI chat)

### iOS Testing:
1. Connect iPhone via USB
2. In Xcode, select your device as target
3. Click Run button (▶️)
4. Test all features

---

## Step 5: Build for Release

### Android - Generate Signed Bundle:
1. Android Studio: Build > Generate Signed Bundle / APK
2. Choose "Android App Bundle"
3. **Create new keystore** (save password securely!):
   - Key store path: Choose location (e.g., `gymsage-keystore.jks`)
   - Password: Create strong password
   - Key alias: `gymsage-key`
   - Validity: 25 years
   - Certificate info: Your name, organization
4. Build completes → `.aab` file created

### iOS - Archive for App Store:
1. In Xcode, select "Any iOS Device" as target
2. Product > Archive
3. Wait for archive to complete
4. Window > Organizer opens
5. Select your archive > Distribute App
6. Choose "App Store Connect"
7. Follow wizard to upload

---

## Step 6: Create App Store Listings

### iOS App Store Connect:
1. Go to https://appstoreconnect.apple.com
2. My Apps > + > New App
3. Fill in:
   - Platform: iOS
   - Name: GymSage
   - Primary Language: English
   - Bundle ID: com.gymsage.app
   - SKU: gymsage-ios-001
4. Complete all sections:
   - **App Information**: Description, keywords, category
   - **Pricing**: Set price (Free or Paid)
   - **App Privacy**: Privacy policy URL required
   - **App Review Information**: Contact details
5. Upload screenshots (required sizes):
   - iPhone 6.7": 1290 x 2796
   - iPhone 6.5": 1242 x 2688
   - iPad Pro 12.9": 2048 x 2732
6. Once uploaded from Xcode, it will appear here
7. Submit for Review

### Google Play Console:
1. Go to https://play.google.com/console
2. Create app:
   - App name: GymSage
   - Default language: English
   - App or game: App
   - Free or paid: Your choice
3. Complete Store listing:
   - Short description (80 chars)
   - Full description (4000 chars)
   - Screenshots (phone, tablet)
   - Feature graphic: 1024 x 500
   - App icon: 512 x 512
4. Complete Content rating questionnaire
5. Set Privacy Policy URL (required)
6. Upload your `.aab` file in Production
7. Submit for review

---

## Step 7: After Submission

### Timeline:
- **iOS**: 24-48 hours for review (can be faster or slower)
- **Android**: 1-3 days for review

### Common Rejection Reasons:
- Missing privacy policy
- App crashes on launch
- Incomplete app information
- Screenshots don't match app
- Missing required icons

---

## Quick Command Reference

### Build and Sync:
```bash
cd frontend
npm run build          # Build React app
npm run cap:sync       # Sync to native platforms
```

### Open IDEs:
```bash
npm run cap:open:ios      # Xcode (Mac only)
npm run cap:open:android  # Android Studio
```

### Test on Device:
- Android: `npm run cap:open:android` > Run button
- iOS: `npm run cap:open:ios` > Run button

---

## Important Notes

1. **API URL**: Already configured to use production backend at `https://gymsage-backend-production-4ebe.up.railway.app/api`

2. **Keystore Security**: 
   - Save your Android keystore password securely
   - You'll need it for every update
   - If lost, you can't update the app

3. **Apple Developer Account**:
   - Takes 24-48 hours to activate after signup
   - Required before you can submit

4. **Testing First**:
   - Always test on real devices before submitting
   - Test offline functionality
   - Test all features thoroughly

5. **Privacy Policy**:
   - Required by both stores
   - Host it online (GitHub Pages, Vercel, etc.)
   - Must explain what data you collect

---

## Need Help?

- **Capacitor Docs**: https://capacitorjs.com/docs
- **iOS Guide**: https://developer.apple.com/app-store/submissions/
- **Android Guide**: https://developer.android.com/distribute/googleplay/start

---

## Current Status ✅

✅ Capacitor installed and configured
✅ Build scripts ready
✅ Configuration files set up
✅ Documentation created

**Next**: Add platforms and start building! 🚀

