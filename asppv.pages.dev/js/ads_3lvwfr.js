/**
 * AryanStreams Global (asppv.pages.dev) - Smart Monetization & Trust Engine
 * Path: /js/ads.js
 *
 * Principles:
 * - High viewability & real impressions across all pages without hurting UX or user trust.
 * - Zero fake download/play buttons, zero DOM blocking, zero control hijacking.
 * - Respects quality switches, fullscreen, volume, and navigation links.
 * - Cross-page Smartlink cooldown + post-modal Popunder guard so two tabs never pop simultaneously.
 */

(function () {
    'use strict';

    // 1. Global protection against third-party ad script MutationObserver exceptions
    if (typeof window !== 'undefined' && typeof window.MutationObserver !== 'undefined' && window.MutationObserver.prototype && window.MutationObserver.prototype.observe) {
        const _origObserve = window.MutationObserver.prototype.observe;
        window.MutationObserver.prototype.observe = function (target, options) {
            if (!target || !(target instanceof Node)) {
                return;
            }
            return _origObserve.call(this, target, options);
        };
    }

    // 2. Global protection against Bitmovin / Shaka / Plyr NotFoundError on DOM node mutations
    if (typeof window !== 'undefined' && typeof Node !== 'undefined' && Node.prototype) {
        const _origRemoveChild = Node.prototype.removeChild;
        Node.prototype.removeChild = function (child) {
            if (!child) return child;
            if (child.parentNode !== this) {
                return child;
            }
            try {
                return _origRemoveChild.call(this, child);
            } catch (e) {
                return child;
            }
        };

        const _origInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function (newNode, refNode) {
            if (!newNode) return newNode;
            try {
                return _origInsertBefore.call(this, newNode, refNode);
            } catch (e) {
                return newNode;
            }
        };
    }

    const STORAGE_KEY_SL = 'asppv_sl_last_ts';
    const PAGE_LOAD_TS = Date.now();

    const SPONSOR_VARIANTS = [
        {
            badge: 'SPONSORED PARTNER',
            title: 'Keep Aryan Streams 100% Free & Buffer-Free',
            desc: 'Support our live HD sports servers by checking out today\'s featured partner offer.',
            cta: 'Explore Offer'
        },
        {
            badge: 'FEATURED PARTNER',
            title: 'Help Keep Live Cricket & Football Free in HD',
            desc: 'Tap to view our verified partner deal — zero registration required to watch matches.',
            cta: 'View Partner'
        }
    ];

    const AryanAds = {
        // ==========================================
        // AD CONFIGURATION (asppv.pages.dev)
        // ==========================================
        POPUNDER_URL: 'https://capitalhospitals.org/1/834323f6ab641540d47a9f0b246bd2f7',
        SMARTLINK_URL: 'https://budgetezy.org/4/eb75e05b1adf598a0f912b4f7e62beed',

        // Domain-wide cooldown for passive smartlink triggers (15 minutes)
        smartlinkCooldownMs: 15 * 60 * 1000,
        // Grace period after page load so Smartlink never collides with Popunder on first click
        gracePeriodMs: 15000,

        enabled: true,
        popunderState: 'idle',
        popunderRetryCount: 0,
        popunderRetryTimer: null,
        hasPlayedCurrentStream: false,

        /**
         * Injects the Popunder script cleanly (idempotent - runs at most once per page)
         */
        initPopunder() {
            if (!this.enabled || !this.POPUNDER_URL) return false;
            if (typeof document === 'undefined' || !document.head && !document.body) return false;

            // Never duplicate if already present in DOM (e.g. placed directly in <head>)
            if (document.querySelector('script[src*="capitalhospitals.org"]')) {
                this.popunderState = 'ready';
                return true;
            }
            if (this.popunderState === 'loading' || this.popunderState === 'ready') {
                return true;
            }
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                return false;
            }

            clearTimeout(this.popunderRetryTimer);
            this.popunderRetryTimer = null;
            this.popunderState = 'loading';

            const self = this;
            const s = document.createElement('script');
            s.setAttribute('data-cfasync', 'false');
            s.setAttribute('fetchpriority', 'high');
            s.async = true;
            s.src = this.POPUNDER_URL;

            s.onload = function () {
                self.popunderState = 'ready';
                s.onload = s.onerror = null;
            };
            s.onerror = function () {
                s.onload = s.onerror = null;
                if (s.parentNode) s.parentNode.removeChild(s);
                self.popunderState = 'failed';
                const delays = [800, 2200];
                if (self.popunderRetryCount < delays.length) {
                    self.popunderRetryTimer = setTimeout(function () {
                        self.initPopunder();
                    }, delays[self.popunderRetryCount++]);
                }
            };

            (document.head || document.body).appendChild(s);
            return true;
        },

        /**
         * Check whether passive Smartlink cooldown & grace period have passed
         */
        canTriggerPassiveSmartlink() {
            if (!this.enabled || !this.SMARTLINK_URL) return false;
            const now = Date.now();
            if (now - PAGE_LOAD_TS < this.gracePeriodMs) return false;

            try {
                const last = parseInt(localStorage.getItem(STORAGE_KEY_SL) || '0', 10);
                if (last && (now - last) < this.smartlinkCooldownMs) return false;
            } catch (e) {}

            return true;
        },

        /**
         * Trigger Smartlink cleanly in a new tab.
         * @param {string} source - Diagnostic label
         * @param {boolean} force - True for explicit user clicks on Sponsored buttons
         */
        triggerSmartlink(source = 'passive', force = false) {
            if (!this.enabled || !this.SMARTLINK_URL) return false;
            if (!force && !this.canTriggerPassiveSmartlink()) return false;

            try {
                localStorage.setItem(STORAGE_KEY_SL, String(Date.now()));
            } catch (e) {}

            try {
                const win = window.open(this.SMARTLINK_URL, '_blank', 'noopener,noreferrer');
                return !!win;
            } catch (e) {
                return false;
            }
        },

        /**
         * Renders clean, transparent, zero-deception Native Sponsor Banners
         * into all `.as-sponsor-slot` elements on the page.
         */
        renderSponsorSlots() {
            if (!this.enabled || !this.SMARTLINK_URL || typeof document === 'undefined') return;
            const slots = document.querySelectorAll('.as-sponsor-slot');
            if (!slots.length) return;

            slots.forEach((slot, idx) => {
                if (slot.dataset.rendered === '1') return;
                slot.dataset.rendered = '1';

                const isCompact = slot.dataset.variant === 'compact';
                const copy = SPONSOR_VARIANTS[idx % SPONSOR_VARIANTS.length];

                slot.innerHTML =
                    '<a class="as-sponsor-card' + (isCompact ? ' is-compact' : '') + '" ' +
                    'href="' + this.SMARTLINK_URL + '" target="_blank" rel="noopener noreferrer sponsored" ' +
                    'aria-label="' + copy.badge + ': ' + copy.title + '">' +
                        '<div class="as-sponsor-left">' +
                            '<div class="as-sponsor-icon" aria-hidden="true">' +
                                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                    '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>' +
                                '</svg>' +
                            '</div>' +
                            '<div class="as-sponsor-copy">' +
                                '<span class="as-sponsor-badge">' + copy.badge + '</span>' +
                                '<strong class="as-sponsor-title">' + copy.title + '</strong>' +
                                '<span class="as-sponsor-desc">' + copy.desc + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<span class="as-sponsor-cta">' +
                            '<span>' + copy.cta + '</span>' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                                '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>' +
                            '</svg>' +
                        '</span>' +
                    '</a>';

                const anchor = slot.querySelector('a');
                if (anchor) {
                    anchor.addEventListener('click', function () {
                        try { localStorage.setItem(STORAGE_KEY_SL, String(Date.now())); } catch (e) {}
                    });
                }
            });
        },

        /**
         * Reset per-stream flag when switching match fixtures
         */
        resetStreamState() {
            this.hasPlayedCurrentStream = false;
        },

        /**
         * Initialize engine safely after DOM readiness
         */
        init() {
            const bootSlots = () => this.renderSponsorSlots();
            if (typeof document !== 'undefined') {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', bootSlots);
                } else {
                    bootSlots();
                }
            }
        }
    };

    // Compatibility alias for any legacy callers
    AryanAds.trigger = function (source, force) {
        return AryanAds.triggerSmartlink(source, force);
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('online', function () {
            if (AryanAds.popunderState === 'failed') {
                AryanAds.popunderRetryCount = 0;
                AryanAds.initPopunder();
            }
        });
        window.AryanAds = AryanAds;
        AryanAds.init();
    }
})();
