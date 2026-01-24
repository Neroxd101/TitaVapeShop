/* =============================================
   Screen Debug Utility
   Logs current screen dimensions and orientation
   ============================================= */

(function() {
  'use strict';

  function logScreenInfo() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation = width > height ? 'landscape' : 'portrait';
    const devicePixelRatio = window.devicePixelRatio || 1;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    // Detect specific known breakpoints
    const knownSizes = [
      { w: 360, h: 740, name: '360x740 (Small Phone)' },
      { w: 375, h: 667, name: '375x667 (iPhone SE/6/7/8)' },
      { w: 375, h: 812, name: '375x812 (iPhone X/11/12/13 mini)' },
      { w: 380, h: 706, name: '380x706 (Small Phone)' },
      { w: 380, h: 754, name: '380x754 (Small Phone)' },
      { w: 380, h: 810, name: '380x810 (Small Phone)' },
      { w: 390, h: 844, name: '390x844 (iPhone 12/13/14 Pro)' },
      { w: 411, h: 823, name: '411x823 (Pixel 2/3)' },
      { w: 412, h: 892, name: '412x892 (Android)' },
      { w: 412, h: 915, name: '412x915 (Android)' },
      { w: 414, h: 736, name: '414x736 (iPhone 6/7/8 Plus)' },
      { w: 414, h: 896, name: '414x896 (iPhone 11 Pro Max/12 Pro Max)' },
      { w: 430, h: 932, name: '430x932 (Pixel 4/5)' },
      { w: 640, h: 889, name: '640x889 (Tablet Portrait)' },
      { w: 800, h: 1145, name: '800x1145 (Tablet Portrait)' },
      { w: 820, h: 1180, name: '820x1180 (iPad Air Portrait)' },
      { w: 912, h: 1368, name: '912x1368 (Tablet Portrait)' },
      { w: 1024, h: 1366, name: '1024x1366 (iPad Pro Portrait)' },
      { w: 1080, h: 2400, name: '1080x2400 (Large Phone Portrait)' }
    ];

    let matchedSize = knownSizes.find(size => 
      Math.abs(size.w - width) <= 2 && Math.abs(size.h - height) <= 2
    );

    const screenInfo = {
      viewport: `${width}x${height}`,
      orientation: orientation,
      devicePixelRatio: devicePixelRatio,
      screen: `${screenWidth}x${screenHeight}`,
      matchedSize: matchedSize ? matchedSize.name : 'Unknown size',
      userAgent: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
      timestamp: new Date().toISOString()
    };

    console.log('%c📱 Screen Debug Info', 'color: #00d4aa; font-size: 14px; font-weight: bold;');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Viewport: ${screenInfo.viewport} ${orientation}`);
    console.log(`Screen: ${screenInfo.screen}`);
    console.log(`Device Pixel Ratio: ${screenInfo.devicePixelRatio}`);
    console.log(`Matched Size: ${screenInfo.matchedSize}`);
    console.log(`Device Type: ${screenInfo.userAgent}`);
    console.log(`Timestamp: ${screenInfo.timestamp}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Also log as object for programmatic access
    window.screenDebugInfo = screenInfo;
    
    return screenInfo;
  }

  // Log on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', logScreenInfo);
  } else {
    logScreenInfo();
  }

  // Log on resize (debounced)
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      console.log('%c🔄 Screen Resized', 'color: #ff9f43; font-size: 12px; font-weight: bold;');
      logScreenInfo();
    }, 300);
  });

  // Log on orientation change
  window.addEventListener('orientationchange', function() {
    setTimeout(function() {
      console.log('%c🔄 Orientation Changed', 'color: #3b82f6; font-size: 12px; font-weight: bold;');
      logScreenInfo();
    }, 100);
  });
})();
