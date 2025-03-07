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
            this.notificationSound = new Audio(path);
            this.notificationSound.load(); // Preload audio
            this.logger.info(`Preloaded sound: ${name}`);
        } catch (error) {
            this.logger.error(`Error preloading sound "${name}":`, error);
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
        const { title, message, icon, conversationId, soundType = 'notification' } = options;
        
        this.logger.info(`Sending notification: ${title} - ${message}`);
        
        // Platform-specific notifications
        if (this.hasNotificationPermission) {
            try {
                // Create OS notification
                const notification = new Notification(title, {
                    body: message,
                    icon: icon || 'images/icon-192x192.png',
                    badge: 'images/icon-192x192.png',
                    tag: conversationId ? `conversation-${conversationId}` : undefined,
                    renotify: !!conversationId,
                    // Add silent option for platform-specific behavior
                    silent: !this.soundsEnabled && this.platform.os === 'windows'
                });
                
                // Handle notification click
                notification.onclick = () => {
                    this.logger.info('Notification clicked');
                    window.focus();
                    
                    if (conversationId) {
                        this.app.state.set('currentConversation', conversationId);
                        window.dispatchEvent(new CustomEvent('open-conversation', { 
                            detail: { conversationId } 
                        }));
                    }
                    
                    notification.close();
                };
            } catch (error) {
                this.logger.error('Error showing notification:', error);
            }
        }
        
        // Play sound based on platform and preferences
        if (this.soundsEnabled) {
            this._playSound(soundType);
        }
        
        // Use vibration if available (mobile devices)
        if (this.vibrationEnabled && this.platform.isMobile && 'vibrate' in navigator) {
            try {
                navigator.vibrate([200, 100, 200]);
                this.logger.info('Device vibration triggered');
            } catch (error) {
                this.logger.error('Error triggering vibration:', error);
            }
        }
        
        // Return true if any notification method was used
        return this.hasNotificationPermission || this.soundsEnabled || 
               (this.vibrationEnabled && this.platform.isMobile && 'vibrate' in navigator);
    }
    
    _playSound(type) {
        try {
            if (!this.notificationSound) {
                this.logger.warn('No sound loaded');
                return false;
            }
            
            // Set volume based on platform
            this.notificationSound.volume = this.platform.isMobile ? 0.7 : 0.5;
            
            // Reset audio to beginning
            this.notificationSound.currentTime = 0;
            
            // Play with platform-specific adjustments
            const playPromise = this.notificationSound.play();
            
            // Handle play promise for browsers that return one
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    this.logger.error('Error playing notification sound:', error);
                });
            }
            
            return true;
        } catch (error) {
            this.logger.error('Error playing sound:', error);
            return false;
        }
    }
}
