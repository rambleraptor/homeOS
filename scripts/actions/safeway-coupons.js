/**
 * Safeway Coupon Clipper
 *
 * This Playwright script logs into Safeway.com and clips all available coupons.
 *
 * Parameters:
 * - email: Safeway account email
 * - password: Safeway account password
 * - verificationCode: Optional 2FA code (if known ahead of time)
 */

const { chromium } = require('playwright');

async function run(parameters, logger = console) {
  const { email, password } = parameters;

  if (!email || !password) {
    throw new Error('Email and password are required parameters');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    logger.log('🏪 Starting Safeway coupon clipper...');

    // Navigate to sign-in page
    logger.log('📍 Navigating to sign-in page...');
    await page.goto('https://www.safeway.com/account/sign-in.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Enter email
    logger.log('📧 Entering email...');
    const emailInput = page.locator('input[placeholder*="Email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(email);

    // Click "Sign in with password"
    logger.log('🔑 Selecting password sign-in method...');
    await page.waitForTimeout(1000); // Small delay for UI
    const signInWithPasswordBtn = page.getByRole('button', { name: /sign in with password/i });
    await signInWithPasswordBtn.click();

    // Wait for password field and enter password
    logger.log('🔐 Entering password...');
    await page.waitForTimeout(1500); // Wait for password field to appear
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill(password);

    // Click Sign In
    logger.log('👤 Signing in...');
    const signInBtn = page.getByRole('button', { name: /^sign in$/i });
    await signInBtn.click();

    // Handle potential 2FA
    await page.waitForTimeout(3000);
    const currentUrl = page.url();

    if (currentUrl.includes('sign-in')) {
      // Check if verification code is needed
      const verificationInput = page.locator('.input-field__otp-code');
      const isVerificationVisible = await verificationInput.isVisible().catch(() => false);

      if (isVerificationVisible) {
        logger.log('⚠️  2FA verification required');
        logger.log('❌ Cannot proceed without verification code');
        logger.log('Note: Manual verification code entry is needed for first-time device authentication');
        throw new Error('2FA verification required - cannot proceed automatically');
      }
    }

    // Wait for successful login - should redirect to deals page or home
    logger.log('⏳ Waiting for login to complete...');
    await page.waitForTimeout(3000);

    // Handle account info confirmation modal if it appears
    const confirmBtn = page.getByRole('button', { name: /this is correct/i });
    const isConfirmVisible = await confirmBtn.isVisible().catch(() => false);
    if (isConfirmVisible) {
      logger.log('✓ Confirming account information...');
      await confirmBtn.click();
      await page.waitForTimeout(1000);
    }

    // Navigate to deals page
    logger.log('🎯 Navigating to deals page...');
    await page.goto('https://www.safeway.com/loyalty/coupons-deals.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Scroll to load all coupons
    logger.log('📜 Loading all coupons...');
    await autoScroll(page);

    // Find all "Clip Coupon" buttons
    logger.log('🔍 Finding available coupons...');
    const clipButtons = await page.getByRole('button', { name: /clip coupon/i }).all();
    const totalCoupons = clipButtons.length;

    logger.log(`✨ Found ${totalCoupons} coupons to clip`);

    if (totalCoupons === 0) {
      logger.log('ℹ️  No coupons available to clip (all may already be clipped)');
      return {
        success: true,
        clipped: 0,
        total: 0,
        message: 'No new coupons to clip'
      };
    }

    // Click each coupon
    let clipped = 0;
    let errors = 0;

    for (let i = 0; i < clipButtons.length; i++) {
      try {
        await clipButtons[i].click();
        clipped++;

        if ((i + 1) % 10 === 0) {
          logger.log(`  Clipped ${i + 1}/${totalCoupons} coupons...`);
        }

        // Small delay between clicks
        await page.waitForTimeout(200);
      } catch (error) {
        errors++;
        logger.log(`  ⚠️  Failed to clip coupon ${i + 1}: ${error.message}`);
      }
    }

    logger.log(`✅ Successfully clipped ${clipped}/${totalCoupons} coupons`);

    if (errors > 0) {
      logger.log(`⚠️  ${errors} coupons failed to clip`);
    }

    return {
      success: true,
      clipped,
      total: totalCoupons,
      errors,
      message: `Clipped ${clipped} of ${totalCoupons} coupons`
    };

  } catch (error) {
    logger.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Auto-scroll the page to load all lazy-loaded content
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          // Scroll back to top
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
    });
  });
}

module.exports = { run };
