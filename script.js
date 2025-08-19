// Service Worker Registration and PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('SW registered: ', registration.scope);
            
            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available
                        if (confirm('New version available! Reload to update?')) {
                            window.location.reload();
                        }
                    }
                });
            });
            
        } catch (error) {
            console.error('SW registration failed: ', error);
        }
    });
}

// PWA Install Prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    
    // Create install button
    const installBtn = document.createElement('button');
    installBtn.textContent = '📱 Install App';
    installBtn.style.position = 'fixed';
    installBtn.style.top = '20px';
    installBtn.style.right = '20px';
    installBtn.style.zIndex = '1000';
    installBtn.style.background = '#4CAF50';
    installBtn.style.color = 'white';
    installBtn.style.border = 'none';
    installBtn.style.padding = '10px 15px';
    installBtn.style.borderRadius = '20px';
    installBtn.style.cursor = 'pointer';
    installBtn.style.fontSize = '14px';
    installBtn.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
    
    installBtn.addEventListener('click', async () => {
        // Hide the install button
        installBtn.style.display = 'none';
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // Clear the deferredPrompt variable
        deferredPrompt = null;
    });
    
    document.body.appendChild(installBtn);
});

// Handle successful installation
window.addEventListener('appinstalled', (evt) => {
    console.log('App was installed successfully');
});

// Handle network status
function updateNetworkStatus() {
    const status = navigator.onLine ? 'online' : 'offline';
    document.body.setAttribute('data-network', status);
    
    if (!navigator.onLine) {
        const offlineMsg = document.createElement('div');
        offlineMsg.id = 'offline-message';
        offlineMsg.textContent = 'You are currently offline. Some features may not work.';
        offlineMsg.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff9800;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 9999;
        `;
        document.body.insertBefore(offlineMsg, document.body.firstChild);
    } else {
        const offlineMsg = document.getElementById('offline-message');
        if (offlineMsg) {
            offlineMsg.remove();
        }
    }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Initialize network status
updateNetworkStatus();

// Prevent zoom on double tap (mobile)
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);
