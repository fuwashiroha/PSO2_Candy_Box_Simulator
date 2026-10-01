(function (root) {
  'use strict';
  function createEngine(data) {
    const candies = new Map(data.candies.map(c => [c.id, c]));
    const pets = new Map(data.pets.map(p => [p.id, p]));
    const categories = new Map(data.categories.map(c => [c.id, c]));
    const clone = value => JSON.parse(JSON.stringify(value));
    const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
    function size(item) { return candies.get(item.candyId)?.stages[item.stage]; }
    function cells(item) {
      const s = size(item); if (!s) return [];
      const out = [];
      for (let y = item.y; y < item.y + s[1]; y++) for (let x = item.x; x < item.x + s[0]; x++) out.push(y * 8 + x);
      return out;
    }
    function blocks(doc) {
      const out = new Map(); const pet = pets.get(doc.petId); if (!pet) return out;
      pet.board.join('').split('').forEach((v, i) => {
        if (v === 'P' || (v === 'J' && doc.level < 50) || (v === 'C' && doc.caramel.includes(i))) out.set(i, v);
      });
      return out;
    }
    function check(doc, item, ignoreUid) {
      const candy = candies.get(item.candyId); const s = size(item);
      if (!candy || !s) return '无法识别糖果或压缩阶段。';
      if (!Number.isInteger(item.x) || !Number.isInteger(item.y) || item.x < 0 || item.y < 0 || item.x + s[0] > 8 || item.y + s[1] > 8) return '超出糖果盒边界。';
      const others = doc.items.filter(i => i.uid !== ignoreUid);
      const category = categories.get(candy.cat);
      if (others.filter(i => candies.get(i.candyId)?.cat === candy.cat).length >= category.limit) return `${category.jp} 最多放置 ${category.limit} 个。`;
      if (candy.cat === 'parfait' && others.some(i => i.candyId === candy.id)) return '同名パフェ只能放置一个；无印、超、絶品可共存。';
      const blocked = blocks(doc); const occupied = new Set(others.flatMap(cells));
      for (const i of cells(item)) {
        if (blocked.has(i)) return ({ P:'纸块不可移除。', C:'该位置有焦糖块，请先清除。', J:'该位置有果冻块，等级达到50后自动消失。' })[blocked.get(i)];
        if (occupied.has(i)) return '该位置与其他糖果重叠。';
      }
      return '';
    }
    function validate(raw) {
      if (!raw || typeof raw !== 'object' || !pets.has(raw.petId)) throw Error('未知宠物。');
      if (!Number.isInteger(raw.level) || raw.level < 1 || raw.level > 130) throw Error('等级应为1–130的整数。');
      if (!Number.isInteger(raw.rarity) || raw.rarity < 1 || raw.rarity > 14) throw Error('稀有度应为1–14。');
      if (!['火','冰','雷','风','光','暗'].includes(raw.attribute)) throw Error('属性无效。');
      if (!Array.isArray(raw.caramel) || new Set(raw.caramel).size !== raw.caramel.length || raw.caramel.some(i => !Number.isInteger(i) || pets.get(raw.petId).board.join('')[i] !== 'C')) throw Error('焦糖块坐标无效。');
      if (!Array.isArray(raw.items) || raw.items.length > 64) throw Error('糖果列表无效。');
      const doc = {petId:raw.petId, name:String(raw.name || '未命名预设').slice(0,100), note:String(raw.note || '').slice(0,3000), level:raw.level, rarity:raw.rarity, attribute:raw.attribute, caramel:[...raw.caramel], items:[]};
      for (const key of ['source','date','kind']) if (typeof raw[key] === 'string') doc[key] = raw[key].slice(0,500);
      for (const item of raw.items) {
        if (!item || typeof item !== 'object' || !Number.isInteger(item.stage)) throw Error('糖果数据或压缩阶段无效。');
        const normalized = {candyId:item.candyId, x:item.x, y:item.y, stage:item.stage, uid:uid()};
        const error = check(doc, normalized);
        if (error) throw Error(`${item.candyId || '未知糖果'}：${error}`);
        doc.items.push(normalized);
      }
      return doc;
    }
    function stats(doc) {
      const fixed = {}; const counts = {}; let override = null;
      for (const item of doc.items) {
        const c = candies.get(item.candyId); counts[c.cat] = (counts[c.cat] || 0) + 1;
        for (const [key,val] of Object.entries(c.stats)) fixed[key] = (fixed[key] || 0) + val;
        if (c.element) override = c.element;
      }
      const cap = doc.rarity >= 13 ? 60 : 50;
      return {fixed,counts,used:doc.items.reduce((n,i) => n+cells(i).length,0),blocked:blocks(doc).size,element:Math.min(cap,10+(fixed.element||0)),cap,attribute:override||doc.attribute,overridden:!!override};
    }
    function empty(petId) { return {petId,name:'空白糖果盒',note:'',level:130,rarity:14,attribute:'光',caramel:[],items:[]}; }
    function importFile(raw) {
      if (!raw || raw.format !== 'pso2-su-candybox' || raw.version !== 1 || !Array.isArray(raw.presets) || raw.presets.length === 0 || raw.presets.length > 2000) throw Error('不是受支持的糖果盒预设文件（版本1）。');
      return raw.presets.map((p,i) => {
        try {return {id:uid(),doc:validate(p.doc || p)};} catch(e) {throw Error(`第 ${i+1} 套预设：${e.message}`);}
      });
    }
    return {candies,pets,categories,clone,uid,size,cells,blocks,check,validate,stats,empty,importFile};
  }
  root.createSUEngine = createEngine;
  if (typeof module !== 'undefined') module.exports = createEngine;
})(typeof window !== 'undefined' ? window : globalThis);
