// Enhanced PWA functionality and service worker management
class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.swRegistration = null;
        this.updateAvailable = false;
        
        this.init();
    }
    
    async init() {
        await this.registerServiceWorker();
        this.setupInstallPrompt();
        this.setupNetworkStatus();
        this.setupPerformanceMonitoring();
        this.preventMobileZoom();
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('sw.js');
                console.log('✅ SW registered:', this.swRegistration.scope);
                
                // Handle service worker updates
                this.swRegistration.addEventListener('updatefound', () => {
                    const newWorker = this.swRegistration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });
                
                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });
                
                // Check for updates every 30 minutes
                setInterval(() => {
                    this.swRegistration.update();
                }, 30 * 60 * 1000);
                
            } catch (error) {
                console.error('❌ SW registration failed:', error);
            }
        }
    }
    
    setupInstallPrompt() {
        // Handle install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });
        
        // Handle successful installation
        window.addEventListener('appinstalled', () => {
            console.log('✅ App installed successfully');
            this.isInstalled = true;
            this.hideInstallButton();
            this.trackInstallation();
        });
        
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
        }
    }
    
    showInstallButton() {
        // Remove existing install button
        const existingBtn = document.getElementById('installBtn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        const installBtn = document.createElement('button');
        installBtn.id = 'installBtn';
        installBtn.innerHTML = '📱 Install App';
        installBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
            transition: all 0.3s ease;
            animation: pulse 2s infinite;
        `;
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        installBtn.addEventListener('click', async () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log(`Install prompt outcome: ${outcome}`);
                
                if (outcome === 'accepted') {
                    this.trackInstallation();
                }
                
                this.deferredPrompt = null;
                installBtn.remove();
            }
        });
        
        document.body.appendChild(installBtn);
    }
    
    hideInstallButton() {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.remove();
        }
    }
    
    showUpdateNotification() {
        this.updateAvailable = true;
        
        const updateNotification = document.createElement('div');
        updateNotification.id = 'updateNotification';
        updateNotification.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #2196F3, #1976D2);
                color: white;
                padding: 15px;
                text-align: center;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            ">
                <p><strong>🆕 New version available!</strong></p>
                <button id="updateBtn" style="
                    background: white;
                    color: #2196F3;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    margin: 5px;
                ">Update Now</button>
                <button id="dismissUpdateBtn" style="
                    background: transparent;
                    color: white;
                    border: 1px solid white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    margin: 5px;
                ">Later</button>
            </div>
        `;
        
        document.body.appendChild(updateNotification);
        
        document.getElementById('updateBtn').addEventListener('click', () => {
            this.applyUpdate();
        });
        
        document.getElementById('dismissUpdateBtn').addEventListener('click', () => {
            updateNotification.remove();
        });
    }
    
    applyUpdate() {
        if (this.swRegistration && this.swRegistration.waiting) {
            this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // Reload page after service worker takes control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    }
    
    setupNetworkStatus() {
        const updateNetworkStatus = () => {
            const isOnline = navigator.onLine;
            document.body.setAttribute('data-network', isOnline ? 'online' : 'offline');
            
            // Remove existing offline message
            const existingMsg = document.getElementById('offline-message');
            if (existingMsg) {
                existingMsg.remove();
            }
            
            if (!isOnline) {
                const offlineMsg = document.createElement('div');
                offlineMsg.id = 'offline-message';
                offlineMsg.innerHTML = `
                    <div style="
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: linear-gradient(135deg, #ff9800, #f57c00);
                        color: white;
                        padding: 12px;
                        text-align: center;
                        z-index: 9999;
                        animation: slideUp 0.3s ease;
                    ">
                        📡 You're offline. The app will continue to work with cached data.
                    </div>
                `;
                document.body.appendChild(offlineMsg);
                
                // Auto-hide after 5 seconds
                setTimeout(() => {
                    if (offlineMsg && offlineMsg.parentNode) {
                        offlineMsg.remove();
                    }
                }, 5000);
            } else {
                // Show back online message briefly
                const onlineMsg = document.createElement('div');
                onlineMsg.innerHTML = `
                    <div style="
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: linear-gradient(135deg, #4CAF50, #45a049);
                        color: white;
                        padding: 12px;
                        text-align: center;
                        z-index: 9999;
                        animation: slideUp 0.3s ease;
                    ">
                        ✅ Back online! All features restored.
                    </div>
                `;
                document.body.appendChild(onlineMsg);
                
                setTimeout(() => {
                    if (onlineMsg && onlineMsg.parentNode) {
                        onlineMsg.remove();
                    }
                }, 3000);
            }
        };
        
        // Add animation styles
        const animationStyle = document.createElement('style');
        animationStyle.textContent = `
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
        `;
        document.head.appendChild(animationStyle);
        
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        
        // Initial check
        updateNetworkStatus();
    }
    
    setupPerformanceMonitoring() {
        // Monitor app performance
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'measure') {
                        console.log(`📊 ${entry.name}: ${entry.duration.toFixed(2)}ms`);
                    }
                }
            });
            
            try {
                observer.observe({ entryTypes: ['measure', 'navigation'] });
            } catch (error) {
                console.warn('Performance monitoring not fully supported');
            }
        }
        
        // Memory usage monitoring (if available)
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                console.log(`🧠 Memory: ${Math.round(memory.usedJSHeapSize / 1048576)}MB used, ${Math.round(memory.totalJSHeapSize / 1048576)}MB total`);
                
                // Warn if memory usage is high
                if (memory.usedJSHeapSize / memory.totalJSHeapSize > 0.9) {
                    console.warn('⚠️ High memory usage detected');
                }
            }, 60000); // Check every minute
        }
    }
    
    preventMobileZoom() {
        // Prevent zoom on double tap (mobile)
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Prevent pinch zoom
        document.addEventListener('touchmove', (event) => {
            if (event.touches.length > 1) {
                event.preventDefault();
            }
        }, { passive: false });
        
        // Prevent zoom on focus for input elements
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                const viewport = document.querySelector('meta[name=viewport]');
                viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
            });
            
            input.addEventListener('blur', () => {
                const viewport = document.querySelector('meta[name=viewport]');
                viewport.setAttribute('content', 'width=device-width, initial-scale=1');
            });
        });
    }
    
    handleServiceWorkerMessage(data) {
        console.log('📨 Message from SW:', data);
        
        if (data.type === 'UPDATE_AVAILABLE') {
            this.showUpdateNotification();
        }
        
        if (data.type === 'CACHE_UPDATED') {
            console.log('✅ Cache updated successfully');
        }
    }
    
    trackInstallation() {
        // Track installation for analytics (optional)
        console.log('📱 App installation tracked');
        
        // You could send this to analytics service
        // analytics.track('app_installed', { timestamp: new Date() });
    }
    
    // Public methods for app to use
    async clearCache() {
        if (this.swRegistration) {
            const messageChannel = new MessageChannel();
            
            return new Promise((resolve) => {
                messageChannel.port1.onmessage = (event) => {
                    resolve(event.data.success);
                };
                
                this.swRegistration.active.postMessage(
                    { type: 'CLEAR_CACHE' },
                    [messageChannel.port2]
                );
            });
        }
        return false;
    }
    
    async getVersion() {
        if (this.swRegistration) {
            const messageChannel = new MessageChannel();
            
            return new Promise((resolve) => {
                messageChannel.port1.onmessage = (event) => {
                    resolve(event.data.version);
                };
                
                this.swRegistration.active.postMessage(
                    { type: 'GET_VERSION' },
                    [messageChannel.port2]
                );
            });
        }
        return 'unknown';
    }
}

// Initialize PWA Manager
const pwaManager = new PWAManager();

// Make PWA manager available globally
window.pwaManager = pwaManager;

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log('📱 App became visible');
        // Check for updates when app becomes visible
        if (pwaManager.swRegistration) {
            pwaManager.swRegistration.update();
        }
    } else {
        console.log('📱 App became hidden');
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    console.log('📱 App is unloading');
});

// Performance mark for app initialization
performance.mark('pwa-script-loaded');
