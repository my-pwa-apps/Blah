import { BaseModule } from '../BaseModule.js';

export class NotificationModule extends BaseModule {
    constructor(app) {
        super(app);
        this.hasNotificationPermission = false;
        this.soundsEnabled = true;
        this.vibrationEnabled = true;
        this.notificationSound = null;
        this.platform = this._detectPlatform();
    }
    
    async init() {
        // Check notification permission
        if ('Notification' in window) {
            this.hasNotificationPermission = Notification.permission === 'granted';
            
            if (Notification.permission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    this.hasNotificationPermission = permission === 'granted';
                    this.logger.info(`Notification permission: ${permission}`);
                } catch (error) {
                    this.logger.error('Failed to request notification permission:', error);
                }
            }
        }
        
        // Preload notification sound
        this._preloadSound('notification', 'sounds/notification.mp3');
        
        // Load user preferences from storage
        this._loadPreferences();
        
        this.logger.info('Notification module initialized', {
            platform: this.platform,
            notificationsEnabled: this.hasNotificationPermission,
            soundsEnabled: this.soundsEnabled,
            vibrationEnabled: this.vibrationEnabled
        });
    }
    
    _detectPlatform() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        
        // Detect mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        
        // Detect OS
        let os = 'unknown';
        if (/Windows/i.test(ua)) os = 'windows';
        else if (/Mac/i.test(ua)) os = 'macos';
        else if (/Linux/i.test(ua)) os = 'linux';
        else if (/Android/i.test(ua)) os = 'android';
        else if (/iPhone|iPad|iPod/i.test(ua)) os = 'ios';
        
        return { isMobile, os };
    }
    
    _preloadSound(name, path) {
        try {
            // Create new Audio instance only if not already loaded
            if (!this.notificationSound) {
                this.notificationSound = new Audio(path);
                
                // Add load error handling
                this.notificationSound.onerror = (error) => {
                    this.logger.error(`Error loading sound "${name}":`, error);
                    this.notificationSound = null;
                };
                
                // Handle iOS audio initialization
                document.addEventListener('touchstart', () => {
                    // iOS requires user interaction to load audio
                    this.notificationSound.load();
                }, { once: true });
                
                this.logger.info(`Preloading sound: ${name}`);
                this.notificationSound.load();
            }
        } catch (error) {
            this.logger.error(`Error setting up sound "${name}":`, error);
            this.notificationSound = null;
        }
    }
    
    _loadPreferences() {
        try {
            const preferences = JSON.parse(localStorage.getItem('notification_preferences')) || {};
            this.soundsEnabled = preferences.soundsEnabled !== false; // Default to true
            this.vibrationEnabled = preferences.vibrationEnabled !== false; // Default to true
        } catch (error) {
            this.logger.error('Error loading notification preferences:', error);
            // Use defaults
            this.soundsEnabled = true;
            this.vibrationEnabled = true;
        }
    }
    
    savePreferences() {
        try {
            const preferences = {
                soundsEnabled: this.soundsEnabled,
                vibrationEnabled: this.vibrationEnabled
            };
            localStorage.setItem('notification_preferences', JSON.stringify(preferences));
        } catch (error) {
            this.logger.error('Error saving notification preferences:', error);
        }
    }
    
    async requestPermission() {
        if (!('Notification' in window)) {
            return false;
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.hasNotificationPermission = permission === 'granted';
            return this.hasNotificationPermission;
        } catch (error) {
            this.logger.error('Error requesting notification permission:', error);
            return false;
        }
    }
    
    async notify(options) {
        const { title, message, icon, conversationId, soundType = 'notification', showNotification = true } = options;
        
        this.logger.info(`Processing notification: ${title}`);
        let notificationShown = false;
        
        // Handle system notification if enabled and permission granted
        if (showNotification && this.hasNotificationPermission) {
            try {
                const notification = new Notification(title, {
                    body: message,
                    icon: icon || 'images/icon-192x192.png',
                    badge: 'images/icon-192x192.png',
                    tag: conversationId ? `conversation-${conversationId}` : undefined,
                    renotify: !!conversationId,
                    // Consider platform specifics
                    silent: !this.soundsEnabled && this.platform.os === 'windows'
                });
                
                notification.onclick = () => {
                    this.logger.info('Notification clicked for conversation:', conversationId);
                    window.focus();
                    
                    if (conversationId) {
                        // Try to open the conversation
                        this.openConversation(conversationId);
                    }
                    
                    notification.close();
                };
                
                notificationShown = true;
                this.logger.info('System notification displayed successfully');
            } catch (error) {
                this.logger.error('Error showing system notification:', error);
            }
        }
        
        // Play sound if enabled (regardless of notification display)
        let soundPlayed = false;
        if (this.soundsEnabled) {
            soundPlayed = this._playSound(soundType);
        }
        
        // Use vibration for mobile if enabled
        let vibrationTriggered = false;
        if (this.vibrationEnabled && this.platform.isMobile && 'vibrate' in navigator) {
            try {
                navigator.vibrate([200, 100, 200]);
                vibrationTriggered = true;
                this.logger.info('Device vibration triggered');
            } catch (error) {
                this.logger.error('Error triggering vibration:', error);
            }
        }
        
        return notificationShown || soundPlayed || vibrationTriggered;
    }
    
    // Helper method to open a conversation when notification is clicked
    openConversation(conversationId) {
        // Dispatch custom event that UIModule can listen for
        window.dispatchEvent(new CustomEvent('open-conversation', {
            detail: { conversationId }
        }));
        
        // Try setting app state if available
        try {
            if (this.app && this.app.state) {
                this.app.state.set('currentConversation', conversationId);
            }
        } catch (error) {
            this.logger.error('Error setting conversation state:', error);
        }
    }
    
    _playSound(type) {
        if (!this.notificationSound || !this.soundsEnabled) return false;
        
        try {
            // Reset and play
            this.notificationSound.currentTime = 0;
            this.notificationSound.volume = this.platform.isMobile ? 0.7 : 0.5;
            
            const playPromise = this.notificationSound.play();
            if (playPromise) {
                playPromise.catch(error => {
                    this.logger.error('Error playing sound:', error);
                    // Retry once on error
                    setTimeout(() => this.notificationSound.play().catch(() => {}), 100);
                });
            }
            return true;
        } catch (error) {
            this.logger.error('Error playing sound:', error);
            return false;
        }
    }
}
