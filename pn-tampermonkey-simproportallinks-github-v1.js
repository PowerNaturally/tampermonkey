// ==UserScript==
// @name         PN – Simpro Links to Portals
// @namespace    powernaturally
// @version      12.1
// @match        https://powernaturally.simprosuite.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      powernaturally.sharepoint.com
// @downloadURL  https://githubusercontent.com
// @updateURL    https://githubusercontent.com
// @match        https://*://*
// ==/UserScript==

(function () {
'use strict';

// ✅ Add hover + active styling
const style = document.createElement('style');
style.textContent = `

  #Links:hover {
    background: #0c5174;
  }

  #Links:hover .leftMenuItem-detail {
    color: #ffffff;
  }

  #Links.pn-active {
    background: #0c5174;
  }

  #Links.pn-active .leftMenuItem-detail {
    color: #ffffff;
  }

`;
document.head.appendChild(style);


const SP = 'https://powernaturally.sharepoint.com/service';
const LIST = 'Online Portals';

let cache={ts:0,data:[]};
let linksLi, submenu;
let hideTimer;

/************* FETCH *************/
function fetchList(){
  if(Date.now()-cache.ts < 15000) return Promise.resolve(cache.data);

  return new Promise(res=>{
    GM_xmlhttpRequest({
      method:'GET',
      url:`${SP}/_api/web/lists/GetByTitle('${LIST}')/items?$top=5000`,
      headers:{Accept:'application/json;odata=nometadata'},
      onload:r=>{
        const data=JSON.parse(r.responseText).value||[];
        cache={ts:Date.now(),data};
        res(data);
      }
    });
  });
}

/************* HELPERS *************/
function getUrl(o){
  for(const k in o){
    const v=o[k];
    if(typeof v==='string' && v.startsWith('http')) return v;
    if(v?.Url) return v.Url;
  }
  return '';
}

/************* CREATE MENU UNDER REPORTS *************/
function ensureMenu(){

  if(document.getElementById('Links')) return;

  const reports=document.getElementById('Reports');
  if(!reports) return;

  linksLi = reports.cloneNode(true);
  linksLi.id='Links';

  linksLi.querySelector('.leftMenuItem-detail').textContent='Portals';

  // ✅ REPLACE ICON WITH CUSTOM SVG
  // ✅ Remove Reports icon completely + add your icon
// ✅ Replace entire icon container (removes Reports icon completely)
const oldIcon = linksLi.querySelector('.leftMenuItem-icon');

if (oldIcon) {
  const newIcon = document.createElement('span');
  newIcon.className = 'leftMenuItem-icon';

  newIcon.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20"
      fill="none" stroke="#bcdff8" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">

      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"></path>
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"></path>

    </svg>
  `;

  oldIcon.replaceWith(newIcon);
}


  // rebuild submenu
  submenu = document.createElement('div');
  submenu.className='leftMenu-submenu';
  submenu.id='submenu_Links';

  submenu.innerHTML=`
    <div class="submenuTitle">
      <span class="leftSubmenu-header">Links</span>
    </div>
    <div class="leftSubmenu-columnContainer blueScrollbar">
      <ul class="leftSubmenu-column leftSubmenu-columns-1" id="pnList"></ul>
    </div>
  `;

  linksLi.appendChild(submenu);

  reports.after(linksLi);

  bindEvents();
}

/************* BUILD LIST *************/
function buildList(items){

  const ul=submenu.querySelector('#pnList');
  ul.innerHTML='';

  // ✅ SORT ALPHABETICALLY
  const sorted = items.slice().sort((a, b) => {
    const aTitle = (a.Title || '').toLowerCase();
    const bTitle = (b.Title || '').toLowerCase();
    return aTitle.localeCompare(bTitle);
  });

  sorted.forEach(i=>{
    const title=i.Title || 'No title';
    const url=getUrl(i) || '#';

    const li=document.createElement('li');
    li.className='leftSubmenuItem';

    const a=document.createElement('a');
    a.className='leftSubmenuItem-label';
    a.href=url;
    a.target='_blank';

    a.append(title);
    li.appendChild(a);
    ul.appendChild(li);
  });

}

/************* OPEN *************/
async function open(){

  const items=await fetchList();
  buildList(items);

  submenu.style.display='block';

  const r=linksLi.getBoundingClientRect();

  let top=r.top;
  const height=submenu.offsetHeight;
  const vh=window.innerHeight;

  if(top+height>vh){
    top=vh-height-10;
  }

  submenu.style.top=top+'px';

  // remove Reports highlight
  const reports = document.getElementById('Reports');
  if (reports) reports.classList.remove('active');

  // activate Links
  linksLi.classList.add('pn-active');

  const reportsParent = document.querySelector('#Reports .leftMenuItem-parent');
  if (reportsParent) reportsParent.classList.remove('hover');
}

/************* CLOSE *************/
function close(){
  submenu.style.display='none';
  linksLi.classList.remove('pn-active');

  const reports = document.getElementById('Reports');
  if (reports) reports.classList.remove('active');
}

/************* EVENTS *************/
function bindEvents(){

  const parent=linksLi.querySelector('.leftMenuItem-parent');

  parent.addEventListener('mouseenter', open);

  linksLi.addEventListener('mouseleave', ()=>{
    clearTimeout(hideTimer);
    hideTimer=setTimeout(close,150);
  });

  submenu.addEventListener('mouseenter', ()=>{
    clearTimeout(hideTimer);
  });

  submenu.addEventListener('mouseleave', ()=>{
    clearTimeout(hideTimer);
    hideTimer=setTimeout(close,150);
  });

  document.addEventListener('mouseenter', e=>{
    const other=e.target.closest('.leftMenuItem');
    if(other && other.id!=='Links'){
      close();
    }
  },true);
}

/************* BOOT *************/
let tries=0;

const boot=setInterval(()=>{
  ensureMenu();
  if(++tries>40) clearInterval(boot);
},200);

})();