# GymSage App Store Deployment Guide

This guide will help you publish GymSage to the iOS App Store and Google Play Store.

## Prerequisites

### For iOS (App Store):
1. **Mac computer** (required for iOS builds)
2. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/
3. **Xcode** (latest version from Mac App Store)
4. **CocoaPods** (for iOS dependencies)

### For Android (Google Play):
1. **Android Studio** (download from https://developer.android.com/studio)
2. **Google Play Developer Account** ($25 one-time fee)
   - Sign up at: https://play.google.com/console/signup
3. **Java Development Kit (JDK)** 11 or higher

## Setup Steps

### 1. Install Capacitor Plugins (if needed)

```bash
cd frontend
npm install @capacitor/splash-screen @capacitor/status-bar
npm run cap sync
```

### 2. Add Mobile Platforms

#### For iOS (Mac only):
```bash
cd frontend
npm run build
npm run cap:add:ios
npm run cap:open:ios  # Opens Xcode
```

#### For Android:
```bash
cd frontend
npm run build
npm run cap:add:android
npm run cap:open:android  # Opens Android Studio
```

## iOS App Store Submission

### Step 1: Configure in Xcode
1. Open the project: `frontend/ios/App/App.xcworkspace` in Xcode
2. Select your project in the navigator
3. Go to **Signing & Capabilities**
4. Select your **Team** (Apple Developer Account)
5. Set **Bundle Identifier**: `com.gymsage.app`
6. Enable **Automatically manage signing**

### Step 2: Build Settings
1. Go to **Build Settings**
2. Set **iOS Deployment Target** to `13.0` or higher
3. Configure **App Icons**:
   - Assets.xcassets > AppIcon
   - Add all required icon sizes (1024x1024, etc.)

### Step 3: Create App in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Click **My Apps** > **+** > **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: GymSage
   - **Primary Language**: English
   - **Bundle ID**: com.gymsage.app
   - **SKU**: gymsage-ios-001
   - **User Access**: Full Access

### Step 4: Archive and Upload
1. In Xcode, select **Any iOS Device** as target
2. Go to **Product** > **Archive**
3. Once archived, click **Distribute App**
4. Choose **App Store Connect**
5. Follow the wizard to upload

### Step 5: Submit for Review
1. In App Store Connect, go to your app
2. Complete **App Information**:
   - Description (up to 4000 characters)
   - Keywords
   - Support URL
   - Marketing URL (optional)
3. Add **Screenshots** (required):
   - iPhone 6.7" (1290 x 2796 pixels)
   - iPhone 6.5" (1242 x 2688 pixels)
   - iPad Pro 12.9" (2048 x 2732 pixels)
4. Set **Age Rating**
5. Set **Pricing**
6. Add **App Review Information**
7. Click **Submit for Review**

## Google Play Store Submission

### Step 1: Configure in Android Studio
1. Open the project: `frontend/android` in Android Studio
2. Wait for Gradle sync to complete
3. Open `app/build.gradle`
4. Update:
   - `applicationId`: `com.gymsage.app`
   - `versionCode`: `1`
   - `versionName`: `"1.0.0"`
   - `minSdkVersion`: `22` (Android 5.1)
   - `targetSdkVersion`: `33` (latest)

### Step 2: Generate Signed Bundle
1. In Android Studio: **Build** > **Generate Signed Bundle / APK**
2. Choose **Android App Bundle**
3. Create a new keystore (if you don't have one):
   - **Key store path**: Choose location
   - **Password**: Create strong password
   - **Key alias**: `gymsage-key`
   - **Validity**: 25 years
   - **Certificate information**: Fill in your details
4. Save the keystore in a secure location! ⚠️
5. Build the bundle

### Step 3: Create App in Google Play Console
1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - **App name**: GymSage
   - **Default language**: English
   - **App or game**: App
   - **Free or paid**: Choose your model
   - **Declarations**: Complete required checkboxes

### Step 4: Complete Store Listing
1. **App details**:
   - Short description (80 characters)
   - Full description (4000 characters)
   - Screenshots (phone, tablet)
   - Feature graphic (1024 x 500)
   - App icon (512 x 512)
2. **Content rating**: Complete questionnaire
3. **Target audience**: Set age groups
4. **Privacy Policy**: Required URL

### Step 5: Upload App Bundle
1. Go to **Production** > **Create new release**
2. Upload your `.aab` file
3. Add **Release notes**
4. Review and roll out

### Step 6: Submit for Review
1. Complete all required sections (green checkmarks)
2. Click **Submit for review**
3. Wait 1-3 days for approval

## Continuous Deployment Workflow

### After Code Changes:
```bash
cd frontend
npm run build          # Build React app
npm run cap:sync       # Sync with native platforms
```

### For iOS:
```bash
npm run cap:open:ios   # Open in Xcode
# Archive and upload from Xcode
```

### For Android:
```bash
npm run cap:open:android  # Open in Android Studio
# Build > Generate Signed Bundle
```

## Important Notes

### API URLs
- Make sure your production backend URL is set in `frontend/src/utils/api.ts`
- Update `CAPACITOR_SERVER_URL` if using different environments

### Icons and Splash Screens
- iOS icons: Use Xcode Asset Catalog
- Android icons: `frontend/android/app/src/main/res/mipmap-*`
- Splash screens configured in `capacitor.config.ts`

### Permissions
- iOS: Configure in `Info.plist` if needed
- Android: Declare in `AndroidManifest.xml` if needed

### Testing
Before submitting:
- Test on real devices (iOS and Android)
- Test all features (login, workouts, photos, AI chat)
- Test offline functionality
- Test on different screen sizes

## Troubleshooting

### iOS Build Issues
- Ensure Xcode is updated to latest version
- Clean build folder: Xcode > Product > Clean Build Folder
- Check signing certificates are valid

### Android Build Issues
- Sync Gradle files: Android Studio > File > Sync Project with Gradle Files
- Check Java/JDK version matches requirements
- Clear build cache: Build > Clean Project

## Resources

- Capacitor Docs: https://capacitorjs.com/docs
- iOS Submission Guide: https://developer.apple.com/app-store/submissions/
- Android Submission Guide: https://developer.android.com/distribute/googleplay/start

## Support

If you encounter issues:
1. Check Capacitor documentation
2. Review platform-specific guides
3. Check GitHub issues for Capacitor
4. Contact Apple/Google developer support

Good luck with your app store submission! 🚀

