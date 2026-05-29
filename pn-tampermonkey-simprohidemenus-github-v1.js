// ==UserScript==
// @name         Hide Simpro Menu Items
// @namespace    http://tampermonkey.net
// @version      1.0
// @description  Hides Simpro Payments and Simpro Lightning from the left menu
// @author       Your Name
// @match        https://powernaturally.simprosuite.com/*
// @grant        GM_addStyle
// @run-at       document-start
// @downloadURL  https://raw.githubusercontent.com/PowerNaturally/tampermonkey/refs/heads/main/pn-tampermonkey-simprohidemenus-github-v1.js
// @updateURL    https://raw.githubusercontent.com/PowerNaturally/tampermonkey/refs/heads/main/pn-tampermonkey-simprohidemenus-github-v1.js
// @match        https://*://*
// ==/UserScript==

(function() {
    'use strict';

    // 1. Fast CSS Hide: Hides elements by their text content via CSS injection
    // This targets the list items containing the specific text strings.
    const css = `
        li.leftMenuItem:has(.leftMenuItem-detail:contains("Simpro Payments")),
        li.leftMenuItem:has(.leftMenuItem-detail:contains("Simpro Lightning")) {
            display: none !important;
        }
    `;

    // Note: If standard CSS :contains isn't supported by the browser engine,
    // the JavaScript fallback below will handle it reliably.

    // 2. JavaScript Fallback & Dynamic Loading Handling
    const targetTexts = ["Simpro Payments", "Simpro Lightning"];

    function hideMenuItems() {
        const menuItems = document.querySelectorAll('li.leftMenuItem');

        menuItems.forEach(item => {
            const detailSpan = item.querySelector('.leftMenuItem-detail');
            if (detailSpan) {
                const text = detailSpan.textContent.trim();
                if (targetTexts.includes(text)) {
                    item.style.setProperty('display', 'none', 'important');
                }
            }
        });
    }

    // Run immediately when DOM is ready
    document.addEventListener('DOMContentLoaded', hideMenuItems);

    // Watch the page for dynamically loaded menu elements
    const observer = new MutationObserver((mutations) => {
        hideMenuItems();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
