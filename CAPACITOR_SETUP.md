# Capacitor iOS Setup - Jaro.dev Studio

This guide explains how to build and install the Jaro.dev Studio app on your iPhone.

## Prerequisites

1. **macOS** - Required for iOS development
2. **Xcode** - Install from the Mac App Store
3. **Apple Developer Account** - Free account works for personal device testing
4. **Node.js** and **pnpm** - Already set up for this project

## How It Works

This app is configured to load the hosted web application (`https://studio.jaro.dev`) inside a native iOS wrapper. This means:
- All authentication, database, and server features work normally
- The app requires an internet connection
- Updates to the web app are immediately available (no app store update needed)

## Installation Steps

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Open the iOS Project in Xcode

```bash
pnpm cap:open:ios
```

This will open the iOS project in Xcode.

### 3. Configure Signing in Xcode

1. In Xcode, select the **App** project in the left sidebar
2. Select the **App** target
3. Go to the **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Team** (your Apple ID)
   - If you don't see a team, click "Add an Account" and sign in with your Apple ID
6. Xcode will automatically create a provisioning profile

### 4. Connect Your iPhone

1. Connect your iPhone to your Mac with a USB cable
2. On your iPhone, trust this computer if prompted
3. In Xcode, select your iPhone from the device dropdown at the top (next to the play button)

### 5. Enable Developer Mode on iPhone (iOS 16+)

If you're on iOS 16 or later:
1. Go to **Settings** > **Privacy & Security** > **Developer Mode**
2. Enable Developer Mode
3. Restart your iPhone when prompted

### 6. Build and Run

1. Click the **Play** button in Xcode (or press `Cmd + R`)
2. Wait for the build to complete
3. On first run, you may see "Untrusted Developer" on your iPhone:
   - Go to **Settings** > **General** > **VPN & Device Management**
   - Tap on your developer certificate
   - Tap **Trust**
4. Run the app again from Xcode

## Development Workflow

### Sync Changes

If you update `capacitor.config.ts`, run:

```bash
pnpm cap:sync
```

### For Local Development

To test against your local development server instead of production:

1. Edit `capacitor.config.ts`:
```typescript
server: {
  url: 'http://YOUR_LOCAL_IP:3000',  // e.g., http://192.168.1.100:3000
  cleartext: true,  // Allow HTTP for local development
}
```

2. Run your dev server:
```bash
pnpm dev
```

3. Sync and rebuild:
```bash
pnpm cap:sync
pnpm cap:open:ios
```

4. Build and run in Xcode

**Note:** Your iPhone and Mac must be on the same network. Use your Mac's local IP address, not `localhost`.

## Customization

### App Icon

Replace the icon in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`:
- You need a 1024x1024 PNG image
- Use a tool like [App Icon Generator](https://www.appicon.co/) to generate all required sizes

### Splash Screen

Replace images in `ios/App/App/Assets.xcassets/Splash.imageset/`:
- Use 2732x2732 PNG images for the splash screen

### App Name

The app name is set to "Jaro.dev Studio". To change it:
1. Edit `capacitor.config.ts` - change `appName`
2. In Xcode, go to App target > General > Display Name

## Troubleshooting

### "Unable to install app" error
- Make sure Developer Mode is enabled on your iPhone
- Check that your Apple ID is signed in under Xcode > Settings > Accounts

### App shows blank screen
- Check your internet connection
- Verify the `server.url` in `capacitor.config.ts` is correct
- Check the Xcode console for any errors

### Build errors
- Run `pnpm cap:sync` to ensure all files are synced
- Try cleaning the build: Product > Clean Build Folder in Xcode

### Signing errors
- Make sure "Automatically manage signing" is checked
- Try removing and re-adding your Apple ID in Xcode settings

## Production Deployment

To distribute the app via TestFlight or the App Store:

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. In Xcode:
   - Product > Archive
   - Distribute App > App Store Connect
3. Submit for review in App Store Connect

## Useful Commands

```bash
# Install dependencies
pnpm install

# Sync Capacitor
pnpm cap:sync

# Open iOS project
pnpm cap:open:ios

# Full build workflow
pnpm cap:build:ios
```


















