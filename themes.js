(function(){
'use strict';
const key='pso2-candy-theme',allowed=['system','light','dark'],media=window.matchMedia('(prefers-color-scheme: dark)');
let choice='system';
try{const stored=localStorage.getItem(key);if(allowed.includes(stored))choice=stored}catch{}
function apply(value){choice=allowed.includes(value)?value:'system';document.documentElement.dataset.themeChoice=choice;document.documentElement.dataset.theme=choice==='system'?(media.matches?'dark':'light'):choice;document.querySelector('meta[name="theme-color"]').content=document.documentElement.dataset.theme==='dark'?'#10171f':'#c3ced7'}
apply(choice);
media.addEventListener('change',()=>{if(choice==='system')apply(choice)});
document.addEventListener('DOMContentLoaded',()=>{const select=document.querySelector('#theme-select');select.value=choice;select.addEventListener('change',()=>{apply(select.value);try{localStorage.setItem(key,choice)}catch{}})},{once:true});
})();
