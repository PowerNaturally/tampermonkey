// ==UserScript==
// @name         Simpro Tasks – Group/Collapse by Category + Visual Cues
// @namespace    https://powernaturally.simprosuite.com/
// @version      2.0
// @description  Groups tasks by Category, adds collapsible headers, and colour cues for Priority, Due Date, and Created Age
// @match        https://powernaturally.simprosuite.com/staff/tasks.php*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/PowerNaturally/tampermonkey/main/pn-tampermonkey-simprotaskcategories-github-v1.js
// @updateURL    https://raw.githubusercontent.com/PowerNaturally/tampermonkey/main/pn-tampermonkey-simprotaskcategories-github-v1.js
// @match        https://*://*
// ==/UserScript==

(function () {
    'use strict';

    const TABLE_ID = 'tasksResultsTable';

    // Column indexes (0-based) from your HTML:
    const COL_CATEGORY = 4;
    const COL_DUE_DATE = 5;
    const COL_PRIORITY = 9;
    const COL_CREATED_DATE = 10;

    const LS_PREFIX = 'tm_simpro_tasks_cat_'; // localStorage prefix for collapsed states

    let observer = null;
    let isProcessing = false;
    let debounceTimer = null;

    function injectStyles() {
        if (document.getElementById('tm-simpro-tasks-style')) return;

        const style = document.createElement('style');
        style.id = 'tm-simpro-tasks-style';
        style.textContent = `/* ================================
   CATEGORY HEADERS
   ================================ */

tr.tm-category-header td {
    font-weight: 800;
    background: #f8fafc;           /* Slate 800 */
    color: #1e293b;                /* Almost white */
    padding: 9px 12px !important;
    border-top: 0px solid #334155; /* Slate 700 */
    border-bottom: 1px solid #334155;
    font-size: 13px;
    cursor: pointer;
    user-select: none;
}

tr.tm-category-header td:hover {
    background: #b4cffa; /* Slight lift on hover */
}

.tm-caret {
    display: inline-block;
    width: 16px;
    margin-right: 6px;
    transition: transform 0.12s ease;
    color: #cbd5e1; /* subtle, readable */
}

tr.tm-category-collapsed .tm-caret {
    transform: rotate(-90deg);
}

.tm-cat-meta {
    margin-left: 10px;
    font-size: 12px;
    font-weight: 700;
    color: #1e293b; /* #e5e7eb light grey – readable on dark bg */
}


/* ================================
   VISIBILITY (COLLAPSE)
   ================================ */

tr.tm-hidden {
    display: none !important;
}


/* ================================
   TASK ROW BASE
   ================================ */

tr.tm-task-row {
    position: relative;
    background: #ffffff;
}


/* ================================
   PRIORITY — LEFT BORDER
   ================================ */

tr.tm-pri-urgent  { box-shadow: inset 6px 0 0 #dc2626; } /* Red 600 */
tr.tm-pri-high    { box-shadow: inset 6px 0 0 #ea580c; } /* Orange 600 */
tr.tm-pri-medium  { box-shadow: inset 6px 0 0 #ca8a04; } /* Amber 600 */
tr.tm-pri-low     { box-shadow: inset 6px 0 0 #2563eb; } /* Blue 600 */
tr.tm-pri-none    { box-shadow: inset 6px 0 0 #9ca3af; } /* Grey */


/* ================================
   DUE DATE — BACKGROUND
   ================================ */

tr.tm-due-overdue {
    background-color: #fee2e2 !important; /* Red 100 */
}

tr.tm-due-soon {
    background-color: #ffedd5 !important; /* Orange 100 */
}

tr.tm-due-week {
    background-color: #fef9c3 !important; /* Yellow 100 */
}


/* ================================
   AGE — RIGHT BORDER
   ================================ */

tr.tm-age-veryold {
    box-shadow:
        inset -6px 0 0 #6d28d9,      /* Purple 700 */
        inset  6px 0 0 var(--left, transparent);
}

tr.tm-age-old {
    box-shadow:
        inset -6px 0 0 #9333ea,      /* Purple 600 */
        inset  6px 0 0 var(--left, transparent);
}

tr.tm-age-mid {
    box-shadow:
        inset -6px 0 0 #c084fc,      /* Purple 400 */
        inset  6px 0 0 var(--left, transparent);
}


/* Preserve left border when combined */
tr.tm-pri-urgent.tm-age-veryold,
tr.tm-pri-urgent.tm-age-old,
tr.tm-pri-urgent.tm-age-mid { --left: #dc2626; }

tr.tm-pri-high.tm-age-veryold,
tr.tm-pri-high.tm-age-old,
tr.tm-pri-high.tm-age-mid { --left: #ea580c; }

tr.tm-pri-medium.tm-age-veryold,
tr.tm-pri-medium.tm-age-old,
tr.tm-pri-medium.tm-age-mid { --left: #ca8a04; }

tr.tm-pri-low.tm-age-veryold,
tr.tm-pri-low.tm-age-old,
tr.tm-pri-low.tm-age-mid { --left: #2563eb; }

tr.tm-pri-none.tm-age-veryold,
tr.tm-pri-none.tm-age-old,
tr.tm-pri-none.tm-age-mid { --left: #9ca3af; }


/* ================================
   CONTROLS BAR
   ================================ */

#tmTasksControls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 10px 0;
}

#tmTasksControls button {
    padding: 6px 10px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
}

#tmTasksControls button:hover {
    background: #f1f5f9;
}

#tmTasksLegend {
    margin-left: auto;
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
}

#tmTasksLegend span {
    display: inline-flex;
    align-items: centre;
    margin-left: 10px;
    gap: 6px;
}

.tmSwatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
    border: 1px solid #cbd5e1;
}`;
        document.head.appendChild(style);
    }

    function parseUKDate(text) {
        const s = (text || '').trim();
        if (!s) return null;
        // expecting dd/mm/yyyy
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!m) return null;
        const d = Number(m[1]);
        const mo = Number(m[2]);
        const y = Number(m[3]);
        const dt = new Date(y, mo - 1, d);
        // sanity check
        if (dt.getFullYear() !== y || dt.getMonth() !== (mo - 1) || dt.getDate() !== d) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
    }

    function daysBetween(a, b) {
        // a - b in whole days
        const ms = 24 * 60 * 60 * 1000;
        return Math.floor((a.getTime() - b.getTime()) / ms);
    }

    function normaliseCategory(cat) {
        return (cat || 'Uncategorised').trim() || 'Uncategorised';
    }

    function storageKeyForCategory(category) {
        return LS_PREFIX + category.toLowerCase();
    }

    function isCollapsed(category) {
        return localStorage.getItem(storageKeyForCategory(category)) === '1';
    }

    function setCollapsed(category, collapsed) {
        localStorage.setItem(storageKeyForCategory(category), collapsed ? '1' : '0');
    }

    function ensureControls(table) {
        if (document.getElementById('tmTasksControls')) return;

        const controls = document.createElement('div');
        controls.id = 'tmTasksControls';

        const btnExpand = document.createElement('button');
        btnExpand.type = 'button';
        btnExpand.textContent = 'Expand all';
        btnExpand.addEventListener('click', () => setAllCollapsed(false));

        const btnCollapse = document.createElement('button');
        btnCollapse.type = 'button';
        btnCollapse.textContent = 'Collapse all';
        btnCollapse.addEventListener('click', () => setAllCollapsed(true));

        const legend = document.createElement('div');
        legend.id = 'tmTasksLegend';
        legend.innerHTML = `
            <span><i class="tmSwatch" style="background:#d92d20"></i>Urgent</span>
            <span><i class="tmSwatch" style="background:rgba(217,45,32,.12)"></i>Overdue</span>
            <span><i class="tmSwatch" style="background:rgba(247,144,9,.14)"></i>Due soon</span>
            <span><i class="tmSwatch" style="background:#7f56d9"></i>Very old</span>
        `;

        controls.appendChild(btnExpand);
        controls.appendChild(btnCollapse);
        controls.appendChild(legend);

        // Insert just above the table
        table.parentElement.insertBefore(controls, table);
    }

    function setAllCollapsed(collapsed) {
        const table = document.getElementById(TABLE_ID);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const headers = Array.from(tbody.querySelectorAll('tr.tm-category-header'));
        headers.forEach(h => {
            const cat = h.dataset.tmCategory;
            if (!cat) return;
            setCollapsed(cat, collapsed);
        });

        // Re-apply collapse state without rebuilding groups
        applyCollapseState();
    }

    function applyCollapseState() {
        const table = document.getElementById(TABLE_ID);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        let currentCat = null;
        let currentCollapsed = false;

        rows.forEach(row => {
            if (row.classList.contains('tm-category-header')) {
                currentCat = row.dataset.tmCategory || null;
                currentCollapsed = currentCat ? isCollapsed(currentCat) : false;
                row.classList.toggle('tm-category-collapsed', currentCollapsed);
                return;
            }

            if (row.classList.contains('tm-task-row')) {
                row.classList.toggle('tm-hidden', !!currentCollapsed);
            }
        });
    }

    function addRowCues(row, today) {
        const tds = row.querySelectorAll('td');
        if (tds.length <= Math.max(COL_CATEGORY, COL_DUE_DATE, COL_PRIORITY, COL_CREATED_DATE)) return;

        const priority = (tds[COL_PRIORITY].innerText || '').trim().toLowerCase();
        const dueText = (tds[COL_DUE_DATE].innerText || '').trim();
        const createdText = (tds[COL_CREATED_DATE].innerText || '').trim();

        // ----- PRIORITY classes -----
        row.classList.remove('tm-pri-urgent', 'tm-pri-high', 'tm-pri-medium', 'tm-pri-low', 'tm-pri-none');

        let priClass = 'tm-pri-none';
        if (priority.includes('urgent')) priClass = 'tm-pri-urgent';
        else if (priority.includes('medium-high') || (priority.includes('high') && !priority.includes('very'))) priClass = 'tm-pri-high';
        else if (priority.includes('medium')) priClass = 'tm-pri-medium';
        else if (priority.includes('low')) priClass = 'tm-pri-low';

        row.classList.add(priClass);

        // ----- DUE DATE classes -----
        row.classList.remove('tm-due-overdue', 'tm-due-soon', 'tm-due-week');
        const due = parseUKDate(dueText);
        if (due) {
            const daysToDue = daysBetween(due, today); // due - today
            // daysToDue < 0 => overdue
            if (daysToDue < 0) {
                row.classList.add('tm-due-overdue');
                row.title = `Overdue by ${Math.abs(daysToDue)} day(s)`;
            } else if (daysToDue <= 3) {
                row.classList.add('tm-due-soon');
                row.title = `Due in ${daysToDue} day(s)`;
            } else if (daysToDue <= 7) {
                row.classList.add('tm-due-week');
                row.title = `Due in ${daysToDue} day(s)`;
            } else {
                row.title = `Due in ${daysToDue} day(s)`;
            }
        }

        // ----- AGE (Created Date) classes -----
        row.classList.remove('tm-age-veryold', 'tm-age-old', 'tm-age-mid');
        const created = parseUKDate(createdText);
        if (created) {
            const ageDays = daysBetween(today, created); // today - created
            if (ageDays >= 180) row.classList.add('tm-age-veryold');
            else if (ageDays >= 90) row.classList.add('tm-age-old');
            else if (ageDays >= 30) row.classList.add('tm-age-mid');

            // Add/extend tooltip
            const existing = row.title ? (row.title + ' · ') : '';
            row.title = `${existing}Created ${ageDays} day(s) ago`;
        }
    }

    function groupAndEnhance() {
        const table = document.getElementById(TABLE_ID);
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        // Avoid double-processing same DOM
        if (tbody.dataset.tmGrouped === 'true') {
            // Still ensure cues and collapse are consistent
            applyCollapseState();
            return;
        }

        injectStyles();
        ensureControls(table);

        const allRows = Array.from(tbody.querySelectorAll('tr'))
            .filter(tr => tr.querySelectorAll('td').length > COL_CATEGORY);

        if (!allRows.length) return;

        // Group in the CURRENT visual order (preserve existing ordering within each category)
        const groups = new Map();

        allRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const cat = normaliseCategory(cells[COL_CATEGORY].innerText);
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(row);
        });

        // Rebuild tbody
        tbody.innerHTML = '';
        const colSpan = table.querySelectorAll('thead th').length || (allRows[0]?.querySelectorAll('td').length ?? 1);

        // Sort categories alpha (change to original insertion order by removing .sort below if preferred)
        const categories = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        categories.forEach(cat => {
            const rows = groups.get(cat);

            // Header row
            const headerRow = document.createElement('tr');
            headerRow.className = 'tm-category-header';
            headerRow.dataset.tmCategory = cat;

            const headerCell = document.createElement('td');
            headerCell.colSpan = colSpan;

            const caret = document.createElement('span');
            caret.className = 'tm-caret';
            caret.textContent = '▾';

            const label = document.createElement('span');
            label.textContent = cat;

            const meta = document.createElement('span');
            meta.className = 'tm-cat-meta';
            meta.textContent = `(${rows.length})`;

            headerCell.appendChild(caret);
            headerCell.appendChild(label);
            headerCell.appendChild(meta);

            headerRow.appendChild(headerCell);
            tbody.appendChild(headerRow);

            // Row block
            rows.forEach(r => {
                r.classList.add('tm-task-row');
                r.dataset.tmCategory = cat;
                addRowCues(r, today);
                tbody.appendChild(r);
            });

            // Click to toggle
            headerRow.addEventListener('click', () => {
                const currentlyCollapsed = isCollapsed(cat);
                setCollapsed(cat, !currentlyCollapsed);
                applyCollapseState();
            });
        });

        // Mark processed
        tbody.dataset.tmGrouped = 'true';

        // Apply persisted collapse state
        applyCollapseState();
    }

    function scheduleRun() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (isProcessing) return;
            isProcessing = true;

            // Temporarily disconnect observer to prevent self-trigger loops
            if (observer) observer.disconnect();
            try {
                // The table can be re-rendered: clear marker if tbody changed
                const table = document.getElementById(TABLE_ID);
                const tbody = table?.querySelector('tbody');
                if (tbody && tbody.dataset.tmGrouped === 'true') {
                    // If Simpro replaced rows but left marker, verify it still has our headers
                    if (!tbody.querySelector('tr.tm-category-header')) {
                        delete tbody.dataset.tmGrouped;
                    }
                }

                groupAndEnhance();
            } finally {
                // Reconnect observer
                startObserver();
                isProcessing = false;
            }
        }, 200);
    }

    function startObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(scheduleRun);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Kick off
    startObserver();
    scheduleRun();

})();
