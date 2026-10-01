(() => {
  'use strict';
  const D = window.SU_DATA, E = createSUEngine(D), $ = id => document.getElementById(id);
  const I = window.SU_I18N, t = I.t;
  I.init();
  const STORE = 'pso2-su-candybox-v1';
  let doc, custom = [], drafts = {}, selectedPet = D.pets[0].id, activeCustom = null;
  let tab = 'built', category = 'parfait', chosen = null, obstacleMode = false;
  let past = [], future = [], dirty = false, pendingImports = [], confirmCallback;
  let savingAvailable = true, loadWarning = '', toastTimer, drag = null, ghost = null;
  const icons = {P:'ペーパーキューブ.png',C:'キャラメルキューブ.png',J:'ゼリーキューブ.png'};
  const statsLabels = {hp:'HP',pp:'PP',satk:'打击力',ratk:'射击力',tatk:'法击力',dex:'技量',sdef:'打击防御',rdef:'射击防御',tdef:'法击防御'};
  const asset = name => 'assets/' + encodeURIComponent(name);
  function el(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=t(text); return n; }
  function rawEl(tag,cls,text){const n=el(tag,cls);n.textContent=text;return n;}
  function presetName(p,isCustom=false){return isCustom?p.name:t(p.name);}
  function img(name, cls='') {const n=el('img',cls);n.src=asset(name);n.alt='';n.draggable=false;return n;}
  function button(text, action, cls='') {const n=el('button',cls,text);n.type='button';n.addEventListener('click',action);return n;}
  function toast(message, error=false) {clearTimeout(toastTimer);$('toast').textContent=t(message);$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,error?6500:3500);}
  function message(text,error=false) {$('interactionHelp').textContent=t(text);$('interactionHelp').classList.toggle('error',error);}
  function link(text,url) {const n=el('a','',text);try{const u=new URL(url);if(u.protocol==='https:'||u.protocol==='http:'){n.href=u.href;n.target='_blank';n.rel='noopener';}}catch{}return n;}
  function initial(pet) {return E.validate(D.presets.find(p=>p.petId===pet) || E.empty(pet));}
  try {
    const stored=localStorage.getItem(STORE);
    if(stored){
      const s=JSON.parse(stored);
      if(s.version!==1 || !Array.isArray(s.custom) || s.custom.length>2000)throw Error('保存格式不匹配');
      custom=s.custom.map(p=>({id:typeof p.id==='string'?p.id:E.uid(),doc:E.validate(p.doc)}));
      const ids=new Set();custom.forEach(p=>{if(ids.has(p.id))p.id=E.uid();ids.add(p.id);});
      for(const pet of D.pets) if(s.drafts?.[pet.id]) {
        const d=s.drafts[pet.id];
        const v=E.validate(d.doc);if(v.petId!==pet.id)throw Error('宠物草稿不匹配');
        drafts[pet.id]={doc:v,activeCustom:custom.some(c=>c.id===d.activeCustom&&c.doc.petId===pet.id)?d.activeCustom:null,dirty:!!d.dirty};
      }
      if(E.pets.has(s.selectedPet))selectedPet=s.selectedPet;
    }
  }catch(error){
    loadWarning='本地保存数据无法读取，已保留原存储；可导入备份继续。'+error.message;
    custom=[];drafts={};savingAvailable=false;
  }
  if(drafts[selectedPet])({doc,activeCustom,dirty}=E.clone(drafts[selectedPet]));else doc=initial(selectedPet);
  function persist() {
    drafts[selectedPet]={doc:E.clone(doc),activeCustom,dirty};
    if(!savingAvailable)return;
    try{localStorage.setItem(STORE,JSON.stringify({version:1,selectedPet,custom,drafts}));}
    catch{savingAvailable=false;toast('浏览器存储不可用。请使用「导出当前」或「导出备份」保存文件。',true);}
  }
  function snapshot(){return E.clone({doc,activeCustom,dirty});}
  function commit(next, name, customId=activeCustom, changed=true) {
    // Validation is atomic: the old board survives every rejected operation.
    let normalized;try{normalized=E.validate(next);}catch(err){toast(err.message,true);return false;}
    // Preserve local item identity after validation so selected pieces remain selected.
    normalized.items.forEach((item,i)=>item.uid=next.items[i].uid || item.uid);
    past.push(snapshot());if(past.length>100)past.shift();future=[];
    doc=normalized;activeCustom=customId;dirty=changed;
    if(chosen?.uid&&!doc.items.some(i=>i.uid===chosen.uid))chosen=null;
    persist();render();if(name)toast(name);return true;
  }
  function undo(redo=false) {
    const from=redo?future:past,to=redo?past:future;if(!from.length)return;
    to.push(snapshot());({doc,activeCustom,dirty}=from.pop());chosen=null;persist();render();toast(redo?'已重做':'已撤销');
  }
  function switchPet(pet){
    if(pet===selectedPet)return;persist();selectedPet=pet;
    if(drafts[pet])({doc,activeCustom,dirty}=E.clone(drafts[pet]));else{doc=initial(pet);activeCustom=null;dirty=false;}
    chosen=null;past=[];future=[];obstacleMode=false;persist();render();
  }
  function renderPets(){
    $('petList').replaceChildren(...D.pets.map(p=>{
      const b=button(p.name,()=>switchPet(p.id),p.id===selectedPet?'active':'');b.setAttribute('aria-current',p.id===selectedPet?'true':'false');return b;
    }));
  }
  function renderPresets(){
    $('builtTab').classList.toggle('active',tab==='built');$('customTab').classList.toggle('active',tab==='custom');
    $('builtTab').setAttribute('aria-pressed',tab==='built');$('customTab').setAttribute('aria-pressed',tab==='custom');
    const mine=custom.filter(p=>p.doc.petId===selectedPet);$('customCount').textContent=mine.length;
    const rows=tab==='built'?D.presets.filter(p=>p.petId===selectedPet).map(p=>({id:p.id,doc:p})):mine;
    $('presetList').replaceChildren();
    if(!rows.length){$('presetList').append(el('div','empty-state','还没有自定义预设。\n调整糖果盒后点击「保存预设」。'));return;}
    rows.forEach((p,index)=>{
      const isActive=tab==='custom'?p.id===activeCustom:!activeCustom&&doc.name===p.doc.name;
      const row=el('div','preset-row'+(isActive?' active':''));
      const b=button('',()=>{chosen=null;commit(p.doc,'已载入 '+p.doc.name,tab==='custom'?p.id:null,false);},'preset-load');
      b.append(rawEl('span','',presetName(p.doc,tab==='custom')),el('small','',tab==='built'?(p.doc.kind==='推导'?'推导参考 · ':'参考 · ')+p.doc.date:`${p.doc.items.length} 个糖果 · ${p.doc.level}级`));row.append(b);
      if(tab==='custom'){
        const actions=el('div','preset-actions');
        actions.append(button('改名',()=>openSave(p.id)),button('复制',()=>copyPreset(p)),button('删除',()=>ask('删除预设',`删除「${p.doc.name}」？当前棋盘会保留。`,()=>{
          custom=custom.filter(c=>c.id!==p.id);if(activeCustom===p.id)activeCustom=null;
          for(const draft of Object.values(drafts))if(draft.activeCustom===p.id)draft.activeCustom=null;
          persist();renderPresets();toast('预设已删除');
        })));
        const up=button('↑',()=>movePreset(p.id,-1));up.disabled=index===0;up.title=t('上移');up.setAttribute('aria-label',t('上移 ')+p.doc.name);
        const down=button('↓',()=>movePreset(p.id,1));down.disabled=index===rows.length-1;down.title=t('下移');down.setAttribute('aria-label',t('下移 ')+p.doc.name);actions.append(up,down);row.append(actions);
      }
      $('presetList').append(row);
    });
  }
  function movePreset(id,delta){
    const mine=custom.filter(p=>p.doc.petId===selectedPet),idx=mine.findIndex(p=>p.id===id),other=mine[idx+delta];if(!other)return;
    const a=custom.findIndex(p=>p.id===id),b=custom.findIndex(p=>p.id===other.id);[custom[a],custom[b]]=[custom[b],custom[a]];persist();renderPresets();
  }
  function uniqueName(name,pet){let n=name,i=2;while(custom.some(p=>p.doc.petId===pet&&p.doc.name===n))n=`${name} (${i++})`;return n;}
  function copyPreset(p){const copy=E.clone(p.doc);copy.name=uniqueName(copy.name+t(' 副本'),copy.petId);custom.push({id:E.uid(),doc:copy});persist();renderPresets();toast('已复制预设');}
  let editId=null;
  function openSave(id){
    editId=id || activeCustom;const exists=custom.find(p=>p.id===editId);
    const from=id&&exists?exists.doc:doc;
    const reference=!exists&&from.kind!=='自定义';
    $('presetName').value=reference?t(from.name):from.name;$('presetNote').value=reference?t(from.note):from.note;
    $('saveConfirm').textContent=t(exists?'保存修改':'保存新预设');$('saveCopy').hidden=!exists;
    $('saveDialog').dataset.metadataOnly=id?'true':'false';$('saveDialog').showModal();$('presetName').focus();$('presetName').select();
  }
  function savePreset(asCopy=false){
    if(!$('saveForm').reportValidity())return;
    const name=$('presetName').value.trim();if(!name){$('presetName').focus();return;}
    const old=custom.find(p=>p.id===editId),metadataOnly=$('saveDialog').dataset.metadataOnly==='true';
    const saved=E.clone(metadataOnly&&old?old.doc:doc);saved.name=name;saved.note=$('presetNote').value.trim();saved.kind='自定义';
    let id=editId;
    if(asCopy||!old){id=E.uid();saved.name=uniqueName(saved.name,saved.petId);custom.push({id,doc:saved});}
    else old.doc=saved;
    if(!metadataOnly){doc=E.clone(saved);activeCustom=id;dirty=false;}else if(activeCustom===id){doc.name=saved.name;doc.note=saved.note;}
    tab='custom';persist();render();$('saveDialog').close();toast(savingAvailable?'已保存到我的预设':'已加入当前列表；浏览器存储不可用，请立即导出备份',!savingAvailable);
  }
  function position(node,item){const [w,h]=E.size(item);Object.assign(node.style,{left:item.x*12.5+'%',top:item.y*12.5+'%',width:w*12.5+'%',height:h*12.5+'%'});}
  function tile(w,h){return w===1&&h===1?'1x1.png':w===1&&h===2?'1x2.png':w===2&&h===1?'2x1.png':w===1&&h===4?'1x4.png':w===4&&h===1?'4x1.png':'2x2.png';}
  function renderBoard(){
    const board=$('board');board.replaceChildren();const blocks=E.blocks(doc),pet=E.pets.get(selectedPet),occupied=new Map();
    for(const it of doc.items)for(const i of E.cells(it))occupied.set(i,it);
    const starColors=['#c1bdde','#fbb48c','#b4cd99','#fec3dd'];
    for(let i=0;i<64;i++){
      const x=i%8,y=Math.floor(i/8),kind=blocks.get(i);
      const cell=button('',()=>cellClick(x,y),'cell'+((x+y)%2?' alt':'')+(kind?' blocked':''));cell.dataset.cell=i;cell.tabIndex=i===0?0:-1;
      cell.style.setProperty('--star',starColors[(x+y)%4]);
      cell.setAttribute('aria-label',t(`${y+1}行${x+1}列，${kind?{P:'不可移除纸块',C:'焦糖块',J:'果冻块'}[kind]:occupied.has(i)?occupied.get(i).candyId:'空格'}`));
      cell.append(kind?img(icons[kind]):el('span','star'));
      if(obstacleMode&&pet.board[y][x]==='C'&&!kind){cell.classList.add('caramel-slot');cell.title=t('恢复此焦糖块');}
      cell.addEventListener('keydown',event=>{
        const d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];if(!d)return;
        event.preventDefault();const next=Math.max(0,Math.min(63,i+d));cell.tabIndex=-1;const target=board.querySelector(`[data-cell="${next}"]`);target.tabIndex=0;target.focus();
      });
      board.append(cell);
    }
    for(let y=0;y<=8;y++)for(let x=0;x<=8;x++){const joint=el('span','grid-joint');joint.style.left=x*12.5+'%';joint.style.top=y*12.5+'%';joint.setAttribute('aria-hidden','true');board.append(joint);}
    for(const item of doc.items){
      const c=E.candies.get(item.candyId),[w,h]=E.size(item);
      const piece=button('',()=>{if(suppressClick)return;choosePiece(item.uid);},'piece'+(chosen?.uid===item.uid?' selected':''));piece.dataset.uid=item.uid;
      piece.setAttribute('aria-label',t(`${c.name}，${item.y+1}行${item.x+1}列，${w}乘${h}，压缩+${item.stage}`));piece.title=`${t(c.name)} · ${w}×${h}\n${t(c.description)}`;
      position(piece,item);piece.append(img(tile(w,h),'tile-base'),img(c.image,'candy-img'),el('span','piece-label',c.name));
      piece.addEventListener('pointerdown',event=>startDrag(event,{...item},false));board.append(piece);
    }
  }
  function defaultHelp(){return obstacleMode?'障碍编辑：点击橙色焦糖块清除；点击原焦糖位置恢复。':chosen?chosen.uid?'已选中糖果：再次点击取消；拖动可移动，长按半秒后拖出盒外可删除。':`准备放置 ${chosen.candyId}：点击格子或从目录拖入。`:'选择右侧糖果，再点击格子放置；也可以拖动。';}
  function choosePiece(uid){if(obstacleMode){toast('请先关闭障碍编辑再移动糖果');return;}const it=doc.items.find(i=>i.uid===uid);if(!it)return;chosen=chosen?.uid===uid?null:{...it};renderSelection();renderBoard();renderCatalog();message(defaultHelp());}
  function chooseCandy(c){chosen={candyId:c.id,stage:c.stages.length-1};obstacleMode=false;renderSelection();renderBoard();renderCatalog();updateTools();message(defaultHelp());}
  function cellClick(x,y){
    if(suppressClick)return;
    if(obstacleMode){toggleCaramel(y*8+x);return;}
    const found=doc.items.find(i=>E.cells(i).includes(y*8+x));
    if(found){choosePiece(found.uid);return;}
    if(!chosen){const b=E.blocks(doc).get(y*8+x);if(b)toast({P:'纸块是固定障碍，不能移除。',C:'请开启「障碍编辑」清除焦糖。',J:'等级达到50后果冻自动消失。'}[b]);return;}
    placeAt(x,y,chosen);
  }
  function placeAt(x,y,selection){
    const item={...selection,x,y,uid:selection.uid||E.uid()};const error=E.check(doc,item,selection.uid);
    if(error){message(error,true);toast(error,true);return false;}
    const next=E.clone(doc);const idx=next.items.findIndex(i=>i.uid===item.uid);
    if(idx>=0)next.items[idx]=item;else next.items.push(item);
    if(selection.uid)chosen={...item};
    return commit(next,idx>=0?'已移动糖果':'已放置 '+item.candyId);
  }
  function removeSelection(){if(!chosen?.uid)return;const next=E.clone(doc);next.items=next.items.filter(i=>i.uid!==chosen.uid);chosen=null;commit(next,'已移除糖果');}
  function toggleCaramel(i){
    const pet=E.pets.get(selectedPet),kind=pet.board.join('')[i];
    if(kind!=='C'){toast(kind==='P'?'纸块不可移除。':kind==='J'?'果冻随等级变化；达到50级自动清除。':'该格不是焦糖的原始位置。');return;}
    const next=E.clone(doc);next.caramel=next.caramel.includes(i)?next.caramel.filter(n=>n!==i):[...next.caramel,i];commit(next,'焦糖状态已更新');
  }
  function renderCatalog(){
    const search=$('search').value.trim().toLowerCase(),only=$('onlyFits').checked;
    const visible=D.candies.filter(c=>(!category||c.cat===category)&&(!search||(c.name+' '+t(c.name)+' '+c.description+' '+t(c.description)+' '+E.categories.get(c.cat).name+' '+E.categories.get(c.cat).jp).toLowerCase().includes(search))).filter(c=>{
      if(!only)return true;const stage=c.stages.length-1;
      for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!E.check(doc,{candyId:c.id,stage,x,y}))return true;
      return false;
    });
    $('catalogLabel').textContent=category?`${t(E.categories.get(category).name)} · ${visible.length}`:t(`全部糖果 · ${visible.length}`);
    const scroll=$('catalog').scrollTop;$('catalog').replaceChildren();
    visible.forEach(c=>{
      const b=button('',()=>{if(!suppressClick)chooseCandy(c);},'candy-card'+(chosen?.candyId===c.id&&!chosen.uid?' active':''));b.dataset.candyId=c.id;
      b.title=t(c.name)+'：'+t(c.description);b.setAttribute('aria-label',t(c.name+'，最大压缩 '+c.stages.at(-1).join('乘')));
      b.append(img(c.image),el('span','candy-name',c.name),el('span','candy-meta',c.rarity+' · '+c.stages.at(-1).join('×')));
      b.addEventListener('pointerdown',event=>startDrag(event,{candyId:c.id,stage:c.stages.length-1},true));$('catalog').append(b);
    });
    if(!visible.length)$('catalog').append(el('div','empty-state','没有符合条件的糖果。'));
    $('catalog').scrollTop=scroll;
  }
  function renderFilters(){
    $('categoryFilters').replaceChildren(...[{id:'',name:'全部'},...D.categories].map(c=>{
      const b=button(c.name,()=>{category=c.id;$('catalog').scrollTop=0;renderFilters();renderCatalog();},category===c.id?'active':'');b.setAttribute('aria-pressed',category===c.id);return b;
    }));
  }
  function renderSelection(){
    const box=$('selection');box.replaceChildren();if(!chosen){box.append(el('div','empty-selection','点击糖果查看效果与压缩尺寸'));return;}
    const c=E.candies.get(chosen.candyId),top=el('div','selection-top'),title=el('div');
    title.append(el('h3','',c.name),el('small','',c.rarity+' · '+E.categories.get(c.cat).jp+(c.shared?' · 共用示意图':'')));top.append(img(c.image),title);box.append(top,el('p','',c.description));
    const controls=el('div','selection-controls'),label=el('label','','压缩 '),select=el('select');select.setAttribute('aria-label',t('选中糖果的压缩阶段'));
    c.stages.forEach((s,i)=>{const op=el('option','',`+${i} · ${s[0]}×${s[1]}${i===c.stages.length-1?'（最小）':''}`);op.value=i;select.append(op);});select.value=chosen.stage;
    select.addEventListener('change',()=>{
      const stage=Number(select.value);
      if(chosen.uid){const next=E.clone(doc),target=next.items.find(i=>i.uid===chosen.uid);target.stage=stage;
        const error=E.check(doc,target,target.uid);if(error){select.value=chosen.stage;toast(error,true);return;}chosen.stage=stage;commit(next,'已修改压缩阶段');
      }else{chosen.stage=stage;message(defaultHelp());}
    });label.append(select);controls.append(label);
    if(chosen.uid)controls.append(button('移除',removeSelection));controls.append(button('取消选择',()=>{chosen=null;renderSelection();renderBoard();renderCatalog();message(defaultHelp());}));box.append(controls);
  }
  function renderStats(){
    const s=E.stats(doc);$('boardUsage').textContent=t(`已用 ${s.used} / ${64-s.blocked} 格 · 剩余 ${64-s.blocked-s.used} 格`);
    const list=el('div','loadout-grid');
    for(const cat of D.categories){
      const section=el('section','loadout-category'),head=el('div','loadout-heading');
      head.append(el('h3','',cat.name),el('span','',`${s.counts[cat.id]||0} / ${cat.limit}`));section.append(head);
      const groups=new Map();for(const item of doc.items)if(E.candies.get(item.candyId).cat===cat.id)groups.set(item.candyId,(groups.get(item.candyId)||0)+1);
      for(const [id,n] of groups){const row=el('div','loadout-row');row.append(el('span','',E.candies.get(id).name),el('strong','',`×${n}`));section.append(row);}
      if(!groups.size)section.append(el('p','loadout-empty','未放置'));list.append(section);
    }
    $('counts').replaceChildren(el('h2','','分类清单'),list);
    const grid=el('div','stat-grid');
    for(const [label,value] of [['HP','+'+(s.fixed.hp||0)],['PP','+'+(s.fixed.pp||0)],['属性 · '+t(s.attribute),s.element+'/'+s.cap]]){const node=el('div','stat-tile');node.append(el('small','',label),el('strong','',value));grid.append(node);}
    const lines=[];for(const [k,name] of Object.entries(statsLabels))if(!['hp','pp'].includes(k)&&s.fixed[k])lines.push(name+' +'+s.fixed[k]);
    $('stats').replaceChildren(grid,el('div','stat-extra',lines.join(' · ')||'尚无其他固定能力增量。'),el('div','stat-extra',(s.overridden?'属性由ラムネ临时覆盖。 ':'')+'固定增量不含宠物本体与条件效果。'));
    const groups=new Map();for(const it of doc.items)groups.set(it.candyId,(groups.get(it.candyId)||0)+1);
    $('effects').replaceChildren(...[...groups].map(([id,count])=>{const c=E.candies.get(id),row=el('div','effect-row');row.append(el('strong','',`${c.name} ×${count}`),el('span','',c.description));return row;}));
  }
  function updateTools(){
    $('undoBtn').disabled=!past.length;$('redoBtn').disabled=!future.length;
    $('obstacleBtn').setAttribute('aria-pressed',obstacleMode);$('obstacleTools').hidden=!obstacleMode;
    $('level').value=doc.level;$('rarity').value=doc.rarity;$('attribute').value=doc.attribute;
  }
  function render(){
    $('petName').textContent=t(selectedPet);$('docName').textContent=presetName(doc,!!activeCustom||doc.kind==='自定义')+t(dirty?' · 已修改':'');
    renderPets();renderPresets();renderBoard();renderStats();renderSelection();renderCatalog();updateTools();message(defaultHelp());
  }
  function preview(x,y,selection){
    $('board').querySelector('.placement-preview')?.remove();
    if(!selection||obstacleMode)return;
    const item={...selection,x,y},error=E.check(doc,item,selection.uid),n=el('div','placement-preview'+(error?' invalid':''));
    position(n,item);n.append(img(E.candies.get(item.candyId).image));$('board').append(n);message(error||`${y+1}行 ${x+1}列 · 可以放置 ${selection.candyId}`,!!error);
  }
  function boardPoint(clientX,clientY){const r=$('board').getBoundingClientRect();if(clientX<r.left||clientY<r.top||clientX>=r.right||clientY>=r.bottom)return null;return {x:Math.floor((clientX-r.left)/r.width*8),y:Math.floor((clientY-r.top)/r.height*8)};}
  let suppressClick=false;
  function startDrag(event,selection,fromCatalog){
    if(event.button!==0||obstacleMode)return;
    if(event.pointerType==='touch'&&fromCatalog)return; // Touch users tap-to-place; catalog remains scrollable.
    const pt=boardPoint(event.clientX,event.clientY);
    drag={selection,fromCatalog,startedAt:performance.now(),lastX:event.clientX,lastY:event.clientY,startX:event.clientX,startY:event.clientY,offsetX:!fromCatalog&&pt?pt.x-selection.x:0,offsetY:!fromCatalog&&pt?pt.y-selection.y:0,started:false,pointerId:event.pointerId};
    drag.timer=setTimeout(()=>{if(drag?.started&&!boardPoint(drag.lastX,drag.lastY))outsideDrag();},500);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function outsideDrag(){
    const ready=!drag.fromCatalog&&performance.now()-drag.startedAt>=500;
    ghost?.classList.toggle('delete-ready',ready);
    message(drag.fromCatalog?'释放到棋盘中放置；释放到外部则取消。':ready?'松开鼠标删除这颗糖果；移回盒内可继续摆放。':'继续按住约半秒可拖出删除；现在松开会取消移动。',ready);
  }
  document.addEventListener('pointermove',event=>{
    if(!drag){const pt=boardPoint(event.clientX,event.clientY);if(pt&&chosen)preview(pt.x,pt.y,chosen);else{$('board').querySelector('.placement-preview')?.remove();}return;}
    if(event.pointerId!==drag.pointerId)return;
    drag.lastX=event.clientX;drag.lastY=event.clientY;
    if(!drag.started&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
    if(!drag.started){drag.started=true;chosen={...drag.selection};renderSelection();ghost=img(E.candies.get(chosen.candyId).image,'drag-ghost');document.body.append(ghost);$('board').querySelector(`[data-uid="${chosen.uid}"]`)?.classList.add('dragging');}
    event.preventDefault();ghost.style.left=event.clientX+12+'px';ghost.style.top=event.clientY+12+'px';
    const pt=boardPoint(event.clientX,event.clientY);if(pt){ghost.classList.remove('delete-ready');preview(pt.x-drag.offsetX,pt.y-drag.offsetY,drag.selection);}else{$('board').querySelector('.placement-preview')?.remove();outsideDrag();}
  },{passive:false});
  function endDrag(event,cancel=false){
    if(!drag||event.pointerId!==drag.pointerId)return;const d=drag;clearTimeout(d.timer);drag=null;ghost?.remove();ghost=null;
    if(d.started){suppressClick=true;setTimeout(()=>suppressClick=false,0);$('board').querySelector('.placement-preview')?.remove();
      const pt=boardPoint(event.clientX,event.clientY);if(pt&&!cancel){if(!placeAt(pt.x-d.offsetX,pt.y-d.offsetY,d.selection))renderBoard();}else if(!cancel&&!pt&&!d.fromCatalog&&performance.now()-d.startedAt>=500&&event.clientX>=0&&event.clientY>=0&&event.clientX<innerWidth&&event.clientY<innerHeight){const next=E.clone(doc);next.items=next.items.filter(i=>i.uid!==d.selection.uid);chosen=null;commit(next,'已拖出删除，可撤销');}else{renderBoard();message(defaultHelp());}
    }
  }
  document.addEventListener('pointerup',event=>endDrag(event));document.addEventListener('pointercancel',event=>endDrag(event,true));
  document.addEventListener('dragstart',event=>event.preventDefault());
  function ask(title,text,callback){$('confirmTitle').textContent=t(title);$('confirmMessage').textContent=t(text);confirmCallback=callback;$('confirmDialog').showModal();}
  $('confirmAction').onclick=()=>{const cb=confirmCallback;confirmCallback=null;$('confirmDialog').close();cb?.();};
  function download(presets,name,draftList){
    const payload={format:'pso2-su-candybox',version:1,exportedAt:new Date().toISOString(),presets:presets.map(p=>({doc:p.doc||p}))};
    if(draftList)payload.drafts=draftList;
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function backupAll(){
    persist();const archive=custom.map(E.clone);
    // Include each in-progress board so backup does not silently lose unsaved editing.
    for(const [pet,d] of Object.entries(drafts)){const copy=E.clone(d.doc);copy.name=copy.name+' [编辑草稿 · '+pet+']';archive.push({doc:copy});}
    if(!archive.length)archive.push({doc:E.clone(doc)});
    download(archive,'SU糖果盒_全部备份_'+new Date().toLocaleDateString('sv-SE'));
  }
  async function readImport(file){
    if(!file)return;if(file.size>10*1024*1024){toast('预设文件不能超过10MB。',true);return;}
    try{pendingImports=E.importFile(JSON.parse(await file.text()));$('importSummary').textContent=t(`已验证 ${pendingImports.length} 套预设，涉及 ${new Set(pendingImports.map(p=>p.doc.petId)).size} 种宠物。`);$('importDialog').showModal();}
    catch(error){toast('导入失败，现有数据未改动。'+error.message,true);}
  }
  function doImport(replace){
    if(!pendingImports.length)return;
    if(replace){backupAll();custom=[];activeCustom=null;for(const d of Object.values(drafts))d.activeCustom=null;}
    for(const p of pendingImports){p.doc.name=uniqueName(p.doc.name,p.doc.petId);custom.push(p);}
    const count=pendingImports.length;pendingImports=[];tab='custom';persist();renderPresets();$('importDialog').close();toast(`已导入 ${count} 套预设；棋盘保持不变。`);
  }
  $('savePreset').onclick=()=>openSave();$('saveForm').onsubmit=e=>{e.preventDefault();savePreset();};$('saveCopy').onclick=()=>savePreset(true);
  $('builtTab').onclick=()=>{tab='built';renderPresets();};$('customTab').onclick=()=>{tab='custom';renderPresets();};
  $('newBlank').onclick=()=>{chosen=null;commit(E.empty(selectedPet),'已新建空白糖果盒',null,true);};
  $('undoBtn').onclick=()=>undo();$('redoBtn').onclick=()=>undo(true);
  $('clearBtn').onclick=()=>ask('清空糖果','移除当前棋盘上的全部糖果，障碍状态保留。可通过撤销恢复。',()=>{const next=E.clone(doc);next.items=[];chosen=null;commit(next,'糖果已清空');});
  $('obstacleBtn').onclick=()=>{obstacleMode=!obstacleMode;chosen=null;render();};
  $('removeCaramel').onclick=()=>{const next=E.clone(doc);next.caramel=[];commit(next,'已清除全部焦糖');};
  $('restoreCaramel').onclick=()=>{const next=E.clone(doc);next.caramel=E.pets.get(selectedPet).board.join('').split('').flatMap((k,i)=>k==='C'?[i]:[]);commit(next,'已恢复全部焦糖');};
  for(const id of ['level','rarity','attribute'])$(id).addEventListener('change',()=>{const next=E.clone(doc);next[id]=id==='attribute'?$(id).value:Number($(id).value);if(!commit(next,'宠物状态已更新'))updateTools();});
  for(let i=14;i>=1;i--){const o=el('option','',`★${i}`);o.value=i;$('rarity').append(o);}
  for(const a of ['火','冰','雷','风','光','暗']){const o=el('option','',a);o.value=a;$('attribute').append(o);}
  $('search').addEventListener('input',()=>{if($('search').value&&category){category='';renderFilters();}$('catalog').scrollTop=0;renderCatalog();});$('onlyFits').onchange=renderCatalog;
  $('exportCurrent').onclick=()=>{download([{doc}],selectedPet+'_'+doc.name);toast('已导出当前棋盘');};$('exportAll').onclick=()=>{backupAll();toast('已导出自定义预设与编辑草稿');};
  $('importBtn').onclick=()=>$('importInput').click();$('importInput').onchange=async()=>{await readImport($('importInput').files[0]);$('importInput').value='';};
  $('mergeImport').onclick=()=>doImport(false);$('replaceImport').onclick=()=>doImport(true);
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey);}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();undo(true);}
    else if(event.key==='Delete'||event.key==='Backspace'){if(chosen?.uid){event.preventDefault();removeSelection();}}
    else if(event.key==='Escape'){clearTimeout(drag?.timer);drag=null;ghost?.remove();ghost=null;chosen=null;renderSelection();renderBoard();renderCatalog();message(defaultHelp());}
  });
  $('language').value=I.lang;
  $('language').onchange=()=>{
    clearTimeout(drag?.timer);drag=null;ghost?.remove();ghost=null;I.set($('language').value);
    $('attribute').querySelectorAll('option').forEach(o=>o.textContent=t(o.value));
    $('toast').hidden=true;renderFilters();render();persist();
  };
  window.addEventListener('pagehide',persist);
  renderFilters();render();persist();if(loadWarning)toast(loadWarning,true);
})();
