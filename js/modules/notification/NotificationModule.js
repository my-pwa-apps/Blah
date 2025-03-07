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
        this._preloadSound('notification', 'sounds/notification.mp3');fx/preview/mixkit-notification-pop-up-951.mp3');
        
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
            this.logger.error(`Error preloading sound "${name}":`, error);ils
        }   this.notificationSound.onerror = () => {
    }           this.logger.warn(`Failed to load sound ${name} from ${path}, trying fallback`);
                try {
    _loadPreferences() {allback to a different hosted sound file
        try {       this.notificationSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-notification-pop-up-951.mp3');
            const preferences = JSON.parse(localStorage.getItem('notification_preferences')) || {};
            this.soundsEnabled = preferences.soundsEnabled !== false; // Default to true
            this.vibrationEnabled = preferences.vibrationEnabled !== false; // Default to true
        } catch (error) {
            this.logger.error('Error loading notification preferences:', error);
            // Use defaults
            this.soundsEnabled = true;reloading sound "${name}":`, error);
            this.vibrationEnabled = true;
        }
    }
    _loadPreferences() {
    savePreferences() {
        try {onst preferences = JSON.parse(localStorage.getItem('notification_preferences')) || {};
            const preferences = {preferences.soundsEnabled !== false; // Default to true
                soundsEnabled: this.soundsEnabled,brationEnabled !== false; // Default to true
                vibrationEnabled: this.vibrationEnabled
            };is.logger.error('Error loading notification preferences:', error);
            localStorage.setItem('notification_preferences', JSON.stringify(preferences));
        } catch (error) {abled = true;
            this.logger.error('Error saving notification preferences:', error);
        }
    }
    
    async requestPermission() {
        if (!('Notification' in window)) {
            return false;nces = {
        }       soundsEnabled: this.soundsEnabled,
                vibrationEnabled: this.vibrationEnabled
        try {;
            const permission = await Notification.requestPermission();ngify(preferences));
            this.hasNotificationPermission = permission === 'granted';
            return this.hasNotificationPermission;cation preferences:', error);
        } catch (error) {
            this.logger.error('Error requesting notification permission:', error);
            return false;
        } requestPermission() {
    }   if (!('Notification' in window)) {
            return false;
    async notify(options) {
        const { title, message, icon, conversationId, soundType = 'notification', showNotification = true } = options;
        try {
        // Use a fallback icon URL if the original doesn't existssion();
        const fallbackIcon = 'https://ui-avatars.com/api/?name=Chat&background=4a6741&color=fff&size=192';sion = permission === 'granted';
        const iconUrl = icon || fallbackIcon;    return this.hasNotificationPermission;
        
        this.logger.info(`Processing notification: ${title}`);ission:', error);
        let notificationShown = false;n false;
        
        // Handle system notification if enabled and permission granted
        if (showNotification && this.hasNotificationPermission) {
            try {
                const notification = new Notification(title, {otification = true } = options;
                    body: message,
                    icon: iconUrl, ${title}`);
                    badge: iconUrl,
                    tag: conversationId ? `conversation-${conversationId}` : undefined,
                    renotify: !!conversationId,e system notification if enabled and permission granted
                    // Consider platform specificscationPermission) {
                    silent: !this.soundsEnabled && this.platform.os === 'windows'
                });= new Notification(title, {
                body: message,
                notification.onclick = () => {/icon-192x192.png',
                    this.logger.info('Notification clicked for conversation:', conversationId);
                    window.focus();ersationId}` : undefined,
                    enotify: !!conversationId,
                    if (conversationId) {// Consider platform specifics
                        // Try to open the conversationnabled && this.platform.os === 'windows'
                        this.openConversation(conversationId);;
                    }
                     => {
                    notification.close();conversationId);
                };cus();
                
                notificationShown = true;       if (conversationId) {
                this.logger.info('System notification displayed successfully');               // Try to open the conversation
            } catch (error) {                this.openConversation(conversationId);
                this.logger.error('Error showing system notification:', error);
            }
        }close();
        
        // Play sound if enabled (regardless of notification display)       
        let soundPlayed = false;        notificationShown = true;
        if (this.soundsEnabled) {ication displayed successfully');
            soundPlayed = this._playSound(soundType);
        }
        
        // Use vibration for mobile if enabled
        let vibrationTriggered = false;
        if (this.vibrationEnabled && this.platform.isMobile && 'vibrate' in navigator) {splay)
            try {se;
                navigator.vibrate([200, 100, 200]);
                vibrationTriggered = true;oundPlayed = this._playSound(soundType);
                this.logger.info('Device vibration triggered');
            } catch (error) {
                this.logger.error('Error triggering vibration:', error);
            }   let vibrationTriggered = false;
        }    if (this.vibrationEnabled && this.platform.isMobile && 'vibrate' in navigator) {
        
        return notificationShown || soundPlayed || vibrationTriggered;, 100, 200]);
    }
    
    // Helper method to open a conversation when notification is clicked
    openConversation(conversationId) {    this.logger.error('Error triggering vibration:', error);
        // Dispatch custom event that UIModule can listen for    }
        window.dispatchEvent(new CustomEvent('open-conversation', {
            detail: { conversationId }
        }));ed || vibrationTriggered;
        
        // Try setting app state if available
        try {pen a conversation when notification is clicked
            if (this.app && this.app.state) {
                this.app.state.set('currentConversation', conversationId);/ Dispatch custom event that UIModule can listen for
            }   window.dispatchEvent(new CustomEvent('open-conversation', {
        } catch (error) {        detail: { conversationId }
            this.logger.error('Error setting conversation state:', error);
        }
    }ble
    
    _playSound(type) {his.app.state) {
        try {   this.app.state.set('currentConversation', conversationId);
            if (!this.notificationSound) {}
                this.logger.warn('No sound loaded');
                return false;
            }
            
            // Set volume based on platform
            this.notificationSound.volume = this.platform.isMobile ? 0.7 : 0.5;nd(type) {
            
            // Reset audio to beginning
            this.notificationSound.currentTime = 0;    this.logger.warn('No sound loaded');
            
            // Play with platform-specific adjustments
            const playPromise = this.notificationSound.play();
            
            // Handle play promise for browsers that return onetificationSound.volume = this.platform.isMobile ? 0.7 : 0.5;
            if (playPromise !== undefined) {
                playPromise.catch(error => {// Reset audio to beginning
                    this.logger.error('Error playing notification sound:', error);ationSound.currentTime = 0;
                });
            }
            mise = this.notificationSound.play();
            return true;   
        } catch (error) {       // Handle play promise for browsers that return one
            this.logger.error('Error playing sound:', error);           if (playPromise !== undefined) {
            return false;                playPromise.catch(error => {




}    }        }                    this.logger.error('Error playing notification sound:', error);
                });
            }
            
            return true;
        } catch (error) {
            this.logger.error('Error playing sound:', error);
            return false;
        }
    }
}
