# /opt/youtube-app/cookie_creator.py
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os
import random

def login_and_refresh_cookies():
    """Login to YouTube and refresh cookies"""
    
    # Your YouTube credentials (store securely)
    YOUTUBE_EMAIL = os.environ.get('YOUTUBE_EMAIL', 'your_email@gmail.com')
    YOUTUBE_PASSWORD = os.environ.get('YOUTUBE_PASSWORD', 'your_password')
    
    options = uc.ChromeOptions()
    
    # Essential options for headless/container environments
    #options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-web-security')
    options.add_argument('--disable-features=VizDisplayCompositor')
    options.add_argument('--remote-debugging-port=9222')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-plugins')
    options.add_argument('--disable-images')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--allow-running-insecure-content')
    options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # Use a custom profile directory
    profile_path = "/opt/youtube-app/chrome_profile"
    options.add_argument(f'--user-data-dir={profile_path}')
    
    # Create profile directory if it doesn't exist
    os.makedirs(profile_path, exist_ok=True)
    os.makedirs('/opt/youtube-app', exist_ok=True)
    os.environ['DISPLAY'] = ':1'  # VNC display
    
    try:
        # Try without specifying version first, and use subprocess=False for better stability
        driver = uc.Chrome(options=options, use_subprocess=False)
        wait = WebDriverWait(driver, 30)
    except Exception as e:
        print(f"❌ Chrome connection error: {e}")
        print("💡 Trying alternative Chrome initialization...")
        
        # Fallback: Try with different settings
        try:
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-background-timer-throttling')
            options.add_argument('--disable-backgrounding-occluded-windows')
            options.add_argument('--disable-renderer-backgrounding')
            driver = uc.Chrome(options=options, version_main=None, use_subprocess=True)
            wait = WebDriverWait(driver, 30)
        except Exception as e2:
            print(f"❌ Fallback Chrome initialization failed: {e2}")
            return False
    
    try:
        print("🔐 Starting YouTube login process...")
        
        # Add random delays to mimic human behavior
        def random_delay(min_sec=2, max_sec=5):
            time.sleep(random.uniform(min_sec, max_sec))
        
        def human_type(element, text):
            """Type like a human with random delays"""
            element.clear()
            for char in text:
                element.send_keys(char)
                time.sleep(random.uniform(0.1, 0.3))
        
        # Check if already logged in by going to YouTube first
        driver.get('https://www.youtube.com')
        random_delay()
        
        # Check if we're already logged in
        try:
            avatar = driver.find_element(By.ID, "avatar-btn")
            print("✅ Already logged in! Refreshing cookies...")
        except:
            print("🔑 Not logged in, proceeding with login...")
            
            # Go to Google accounts for login
            driver.get('https://accounts.google.com')
            random_delay()
            
            # Enter email
            email_input = wait.until(EC.presence_of_element_located((By.ID, "identifierId")))
            human_type(email_input, YOUTUBE_EMAIL)
            
            # Click Next
            next_button = wait.until(EC.element_to_be_clickable((By.ID, "identifierNext")))
            next_button.click()
            random_delay()
            
            # Enter password
            password_input = wait.until(EC.element_to_be_clickable((By.NAME, "password")))
            human_type(password_input, YOUTUBE_PASSWORD)
            
            # Click Next
            password_next = wait.until(EC.element_to_be_clickable((By.ID, "passwordNext")))
            password_next.click()
            random_delay(5, 10)
            
            # Check for potential issues
            current_url = driver.current_url
            page_source = driver.page_source.lower()
            
            if "challenge" in current_url or "verification" in page_source:
                print("❌ 2FA or verification required")
                # Save debug info
                driver.save_screenshot('/opt/youtube-app/login_error.png')
                with open('/opt/youtube-app/login_error.html', 'w') as f:
                    f.write(driver.page_source)
                return False
            
            if "signin/rejected" in current_url or "couldn't sign you in" in page_source:
                print("❌ Login rejected by Google")
                print("💡 Try: 1) Use App Password 2) Enable 'Less secure app access' 3) Check account settings")
                # Save debug info
                driver.save_screenshot('/opt/youtube-app/login_error.png')
                with open('/opt/youtube-app/login_error.html', 'w') as f:
                    f.write(driver.page_source)
                return False
            
            # Wait for potential 2FA or verification
            print("Waiting for login completion...")
            time.sleep(10)
            
            # Now go to YouTube
            driver.get('https://www.youtube.com')
            random_delay()
        
        # Check if logged in by looking for user avatar
        try:
            wait.until(EC.presence_of_element_located((By.ID, "avatar-btn")))
            print("✅ Successfully logged in to YouTube!")
        except:
            print("⚠️ Login verification failed")
            # Save debug info
            driver.save_screenshot('/opt/youtube-app/login_error.png')
            with open('/opt/youtube-app/login_error.html', 'w') as f:
                f.write(driver.page_source)
            return False
        
        # Navigate around a bit to ensure cookies are fresh
        pages_to_visit = [
            'https://www.youtube.com',
            'https://www.youtube.com/feed/subscriptions',
            'https://www.youtube.com/feed/trending'
        ]
        
        for page in pages_to_visit:
            try:
                driver.get(page)
                random_delay(2, 4)
            except Exception as nav_error:
                print(f"⚠️ Navigation warning: {nav_error}")
                continue
        
        # Extract cookies
        cookies = driver.get_cookies()
        
        # Convert to Netscape format
        cookie_lines = []
        for cookie in cookies:
            if 'youtube.com' in cookie['domain'] or 'google.com' in cookie['domain']:
                secure = "TRUE" if cookie.get('secure', False) else "FALSE"
                expiry = int(cookie.get('expiry', time.time() + 86400 * 7))  # 7 days expiry
                line = f"{cookie['domain']}\tTRUE\t{cookie['path']}\t{secure}\t{expiry}\t{cookie['name']}\t{cookie['value']}"
                cookie_lines.append(line)
        
        # Save cookies
        cookie_file = '/opt/youtube-app/cookies.txt'
        with open(cookie_file, 'w') as f:
            f.write('# Netscape HTTP Cookie File\n')
            f.write('# Generated by automated login\n')
            f.write('\n'.join(cookie_lines))
        
        print(f"✅ Cookies saved at {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📊 Saved {len(cookie_lines)} cookies")
        
        return True
        
    except Exception as e:
        print(f"❌ Login failed: {e}")
        
        # Take screenshot for debugging
        try:
            driver.save_screenshot('/opt/youtube-app/login_error.png')
            print("📸 Screenshot saved to /opt/youtube-app/login_error.png")
        except:
            pass
        
        # Save page source for debugging
        try:
            with open('/opt/youtube-app/login_error.html', 'w') as f:
                f.write(driver.page_source)
            print("📄 Page source saved to /opt/youtube-app/login_error.html")
        except:
            pass
        
        return False
        
    finally:
        try:
            driver.quit()
        except:
            pass

def check_cookie_validity():
    """Check if existing cookies are still valid"""
    print("🔍 Checking existing cookie validity...")
    
    try:
        options = uc.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-web-security')
        options.add_argument('--disable-features=VizDisplayCompositor')
        options.add_argument('--remote-debugging-port=9223')  # Different port for validation
        options.add_argument('--window-size=1920,1080')
        
        try:
            driver = uc.Chrome(options=options, use_subprocess=False)
        except Exception as e:
            print(f"❌ Chrome validation error: {e}")
            return False
        
        # Load existing cookies if they exist
        cookie_file = '/opt/youtube-app/cookies.txt'
        if not os.path.exists(cookie_file):
            print("❌ No cookie file found")
            driver.quit()
            return False
        
        driver.get('https://www.youtube.com')
        time.sleep(2)
        
        # Load cookies from file
        with open(cookie_file, 'r') as f:
            loaded_cookies = 0
            for line in f:
                if line.startswith('#') or not line.strip():
                    continue
                parts = line.strip().split('\t')
                if len(parts) >= 7:
                    cookie = {
                        'name': parts[5],
                        'value': parts[6],
                        'domain': parts[0],
                        'path': parts[2],
                        'secure': parts[3] == 'TRUE'
                    }
                    try:
                        driver.add_cookie(cookie)
                        loaded_cookies += 1
                    except Exception as cookie_error:
                        continue
        
        print(f"📊 Loaded {loaded_cookies} cookies")
        
        # Refresh page and check login status
        driver.refresh()
        time.sleep(3)
        
        # Check if logged in
        try:
            driver.find_element(By.ID, "avatar-btn")
            print("✅ Cookies are valid!")
            driver.quit()
            return True
        except:
            print("❌ Cookies are invalid or expired")
            driver.quit()
            return False
            
    except Exception as e:
        print(f"❌ Cookie validation error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 YouTube Cookie Manager Starting...")
    
    # Check if cookies are still valid first
    if check_cookie_validity():
        print("✅ Existing cookies are still valid! No refresh needed.")
    else:
        print("🔄 Cookies invalid or missing, refreshing...")
        success = login_and_refresh_cookies()
        if success:
            print("🎉 Cookie refresh completed successfully!")
        else:
            print("💥 Cookie refresh failed!")
            print("🔧 Troubleshooting tips:")
            print("   1. Set environment variables: YOUTUBE_EMAIL and YOUTUBE_PASSWORD")
            print("   2. Use App Password instead of regular password")
            print("   3. Check /opt/youtube-app/login_error.html for details")
            print("   4. Verify Google account security settings")