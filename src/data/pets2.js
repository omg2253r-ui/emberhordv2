// v7 pets: thirty more companions. Every one has its own body (src/art/petForge.js) and its own ability kind or
// a combination no other pet has (src/battle/pets.js runs them). Numbers scale with stars like the originals.
//
// new ability kinds:
//   spit     { every, power, count, spread, burn }       fan of globs at the nearest enemy
//   ward     { every, charges }                           a charm that cancels the hero's next hit(s)
//   mine     { every, power, r, slow }                    drops a sticky mine that bursts when an enemy steps near
//   vortex   { every, r, pull, power }                    drags enemies around a point together
//   chain    { every, power, jumps, range }               lightning that jumps between enemies
//   crit     { every, crit, duration }                    critical chance up for a while
//   nova     { every, power, r, slow, slowT }             frost burst around the pet that slows
//   stomp    { every, power, r, stun }                    leaps on the nearest enemy and stuns around it
//   leech    { every, power, healPct, range }             drain: hits and heals the hero
//   beam     { every, power, len, width }                 a line that pierces everything
//   venom    { every, power, range }                      a bite that poisons (burn ticks)
//   rain     { every, power, count, r }                   a few blasts land around the target
//   guardian { below, healPct, shieldPct }                once per dungeon, saves the hero when they drop low
//   haste    { every, haste, duration }                   attack speed up
//   trail    { power, r, life }                           leaves burning ground where it walks
//   pierce   { every, power, len, width }                 dashes through a line of enemies and back
//   fan      { every, power, count, spread }              piercing bolts in a fan
//   ambush   { every, power, execute }                    blinks behind the weakest enemy; finishes the hurt ones
//   orbit    { power, radius, speed, hitEvery }           circles the hero and cuts whatever it touches
//   howl     { every, r, stun, reduce, duration }         scares nearby enemies; the hero takes less damage
//   drizzle  { every, healPct, r, slow }                  rain that heals the hero and slows enemies around them
//   absorb   { every, r, max }                            swallows enemy projectiles near the hero
//   rebirth  { every, power, r }                          once per dungeon brings the hero back at half health; fire rings
//   grasp    { every, power, count, stun, range }         tentacles seize several enemies at once
//   sanctuary{ every, r, duration, reduce, healPct }      holy ground: less damage taken and healing inside
//   foxfire  { every, power, count }                      a ring of homing foxfires
//   quake    { every, power, r, stun }                    three waves of earth rolling out
// new passive keys: dodgeCd, spd, critPct, defPct, thorns
const pct = (v) => Math.round(v * 100);

export const PETS_V7 = Object.freeze({
  // ---------------------------------------------------------------- common
  ember_pup: {
    id: 'ember_pup', name: 'ลูกหมาถ่าน', rarity: 'common', role: 'ช่วยโจมตี', sprite: 'pet_ember_pup',
    desc: 'ลูกหมาตัวอุ่นที่เห่าออกมาเป็นสะเก็ดไฟ', art: { plan: 'quad', c1: '#c4492e', c2: '#f3d0a0', c3: '#ffb35a', ears: 'droop', tail: 'flame', pat: 'spots', build: 'stocky' },
    ability: { kind: 'spit', name: 'เห่าสะเก็ดไฟ', every: 2.2, power: 0.34, count: 2, spread: 18, burn: true },
    text: (v) => `ทุก ${v.every} วินาที พ่นสะเก็ดไฟ ${v.count} ลูก ×${v.power.toFixed(2)} และติดไฟ`,
  },
  pebble_crab: {
    id: 'pebble_crab', name: 'ปูกรวด', rarity: 'common', role: 'ป้องกัน', sprite: 'pet_pebble_crab',
    desc: 'แบกกรวดไว้บนหลัง แล้วโยนให้เจ้านายใช้บังหมัด', art: { plan: 'crab', c1: '#c8784a', c2: '#a8a094', c3: '#e8d8b0', shell: 'pebble', pat: 'none' },
    ability: { kind: 'ward', name: 'กรวดกำบัง', every: 14, charges: 1 },
    text: (v) => `ทุก ${v.every} วินาที ให้เครื่องรางกรวด: กันการโดนตีครั้งถัดไปได้ ${v.charges} ครั้ง`,
  },
  dew_slime: {
    id: 'dew_slime', name: 'สไลม์น้ำค้าง', rarity: 'common', role: 'ควบคุม', sprite: 'pet_dew_slime',
    desc: 'หยดเมือกเหนียวไว้ตามทาง ใครเหยียบจะติดหนึบ', art: { plan: 'blob', c1: '#7fd0c0', c2: '#bff0e8', c3: '#e8fff8', drip: true, leaf: true, clear: true },
    ability: { kind: 'mine', name: 'เมือกเหนียว', every: 4, power: 0.42, r: 70, slow: 0.5 },
    text: (v) => `ทุก ${v.every} วินาที ปาเมือกใต้เท้าศัตรู: ระเบิด ×${v.power.toFixed(2)} เมื่อศัตรูเข้าใกล้ และทำให้ช้าลง`,
  },
  mud_frog: {
    id: 'mud_frog', name: 'กบโคลน', rarity: 'common', role: 'ควบคุม', sprite: 'pet_mud_frog',
    desc: 'ลิ้นยาวเหนียวหนึบ ตวัดทีเดียวลากศัตรูมากองรวมกัน', art: { plan: 'hopper', form: 'frog', c1: '#7a8a4a', c2: '#d8d0a0', c3: '#5d8a3e', pat: 'spots', leaf: true },
    ability: { kind: 'vortex', name: 'ลิ้นตวัด', every: 7, r: 170, pull: 300, power: 0.2 },
    text: (v) => `ทุก ${v.every} วินาที ดึงศัตรูรอบเป้าหมายมารวมกัน ×${v.power.toFixed(2)}`,
  },
  spark_beetle: {
    id: 'spark_beetle', name: 'ด้วงประกาย', rarity: 'common', role: 'ช่วยโจมตี', sprite: 'pet_spark_beetle', flying: true,
    desc: 'ปีกแข็งสะสมไฟฟ้าสถิต ปล่อยออกเป็นสายฟ้าเล็กๆ', art: { plan: 'insect', form: 'beetle', c1: '#3a5aa8', c2: '#9fb8ff', c3: '#fff07a', pat: 'stripes' },
    ability: { kind: 'chain', name: 'สายฟ้าแตกกิ่ง', every: 2.4, power: 0.38, jumps: 2, range: 300 },
    text: (v) => `ทุก ${v.every} วินาที ปล่อยสายฟ้า ×${v.power.toFixed(2)} กระโดดต่ออีก ${v.jumps} ตัว`,
  },
  leaf_hare: {
    id: 'leaf_hare', name: 'กระต่ายใบไม้', rarity: 'common', role: 'ความเร็ว', sprite: 'pet_leaf_hare',
    desc: 'กระโดดนำหน้าเสมอ ทำให้เจ้านายเท้าไวตามไปด้วย', art: { plan: 'hopper', form: 'rabbit', c1: '#d8c8a0', c2: '#fff6e0', c3: '#6aa25a', leaf: true },
    ability: { kind: 'passive', name: 'เท้าไว', dodgeCd: 0.12, spd: 0.05 },
    text: (v) => `ชาร์จหลบฟื้นเร็วขึ้น ${pct(v.dodgeCd)}% · ความเร็ว +${pct(v.spd)}%`,
  },
  coin_magpie: {
    id: 'coin_magpie', name: 'นกกางเขนเหรียญ', rarity: 'common', role: 'ทอง + คริติคอล', sprite: 'pet_coin_magpie', flying: true,
    desc: 'ชอบของแวววาว มองเห็นจุดอ่อนของศัตรูพอๆ กับเหรียญที่ตกพื้น', art: { plan: 'bird', c1: '#2a2e3a', c2: '#f4f6ff', c3: '#f5c35a', beak: 'normal', tailF: 'long', wing: 'feather' },
    ability: { kind: 'passive', name: 'ตาแหลม', goldMult: 0.12, critPct: 0.025 },
    text: (v) => `ทอง +${pct(v.goldMult)}% · โอกาสคริติคอล +${(v.critPct * 100).toFixed(1)}%`,
  },
  ash_moth: {
    id: 'ash_moth', name: 'ผีเสื้อกลางคืนเถ้า', rarity: 'common', role: 'บัพคริติคอล', sprite: 'pet_ash_moth', flying: true,
    desc: 'ผงเถ้าจากปีกทำให้ศัตรูมองไม่เห็นจังหวะคมดาบ', art: { plan: 'insect', form: 'moth', c1: '#6a5a50', c2: '#c8bca8', c3: '#ff8a3d' },
    ability: { kind: 'crit', name: 'ผงเถ้าพราง', every: 9, crit: 0.12, duration: 4 },
    text: (v) => `ทุก ${v.every} วินาที โอกาสคริติคอล +${pct(v.crit)}% นาน ${v.duration} วินาที`,
  },
  // ---------------------------------------------------------------- rare
  frost_kit: {
    id: 'frost_kit', name: 'ลูกจิ้งจอกหิมะ', rarity: 'rare', role: 'ควบคุม', sprite: 'pet_frost_kit',
    desc: 'หายใจออกมาเป็นละอองน้ำแข็ง ทุกสิ่งรอบตัวมันเชื่องช้าลง', art: { plan: 'quad', c1: '#e8f4ff', c2: '#ffffff', c3: '#8fd0f0', ears: 'pointy', tail: 'bushy', pat: 'none', eye: '#3a7ab8' },
    ability: { kind: 'nova', name: 'ระเบิดหิมะ', every: 5, power: 0.34, r: 140, slow: 0.55, slowT: 2 },
    text: (v) => `ทุก ${v.every} วินาที เมื่อศัตรูเข้าประชิด กระโดดมาระเบิดหิมะรอบตัวเรา ×${v.power.toFixed(2)} ศัตรูช้าลง ${v.slowT} วินาที`,
  },
  thunder_ram: {
    id: 'thunder_ram', name: 'แกะสายฟ้า', rarity: 'rare', role: 'สตัน', sprite: 'pet_thunder_ram',
    desc: 'กระโดดพุ่งเขาใส่ศัตรู ทุกครั้งที่ลงพื้นจะมีฟ้าผ่าตามมา', art: { plan: 'quad', c1: '#e8e2d0', c2: '#ffffff', c3: '#ffd83a', ears: 'droop', horns: 'curl', tail: 'thin', pat: 'none', build: 'stocky', wool: true },
    ability: { kind: 'stomp', name: 'กระทุ้งฟ้า', every: 5, power: 0.62, r: 100, stun: 0.6 },
    text: (v) => `ทุก ${v.every} วินาที กระโดดทุบเป้าหมาย ×${v.power.toFixed(2)} สตันรอบตัว ${v.stun} วินาที`,
  },
  blood_bat: {
    id: 'blood_bat', name: 'ค้างคาวโลหิต', rarity: 'rare', role: 'ดูดพลัง', sprite: 'pet_blood_bat', flying: true,
    desc: 'กัดเบาๆ แต่ทุกหยดที่ดูดมาจะคืนเป็นพลังให้เจ้านาย', art: { plan: 'bird', c1: '#4a2a3a', c2: '#8a4a5a', c3: '#e0503a', wing: 'bat', beak: 'fang', crest: 'ears', eye: '#ff5a5a' },
    ability: { kind: 'leech', name: 'ดูดโลหิต', every: 2.5, power: 0.42, healPct: 0.01, range: 320 },
    text: (v) => `ทุก ${v.every} วินาที ดูดเลือด ×${v.power.toFixed(2)} และฟื้นพลังชีวิต ${(v.healPct * 100).toFixed(1)}%`,
  },
  coral_fish: {
    id: 'coral_fish', name: 'ปลาปะการังลอยฟ้า', rarity: 'rare', role: 'ช่วยโจมตี', sprite: 'pet_coral_fish', flying: true,
    desc: 'ว่ายในอากาศได้ และพ่นลำน้ำแรงพอจะเจาะหิน', art: { plan: 'fish', c1: '#ff9a7a', c2: '#ffe0d0', c3: '#ff5a8a', pat: 'coral' },
    ability: { kind: 'beam', name: 'ลำน้ำทะลวง', every: 3.5, power: 0.78, len: 380, width: 34 },
    text: (v) => `ทุก ${v.every} วินาที พ่นลำน้ำเป็นเส้นตรง ×${v.power.toFixed(2)} ทะลุทุกตัว`,
  },
  iron_beetle: {
    id: 'iron_beetle', name: 'ด้วงเกราะเหล็ก', rarity: 'rare', role: 'ป้องกัน + สะท้อน', sprite: 'pet_iron_beetle',
    desc: 'เปลือกแข็งเหมือนโล่ ใครตีเจ้านายจะโดนหนามสะท้อนกลับ', art: { plan: 'insect', form: 'beetle', c1: '#7a8090', c2: '#c8ccd4', c3: '#e0b45a', horn: 'rhino', pat: 'ribs' },
    ability: { kind: 'passive', name: 'เกราะหนาม', defPct: 0.08, thorns: 0.4 },
    text: (v) => `ป้องกัน +${pct(v.defPct)}% · ศัตรูที่ตีเราในระยะประชิดโดนหนามสะท้อน ×${v.thorns.toFixed(2)}`,
  },
  jade_snake: {
    id: 'jade_snake', name: 'งูหยก', rarity: 'rare', role: 'พิษ', sprite: 'pet_jade_snake',
    desc: 'เขี้ยวมีพิษเย็นเยียบ เหยื่อจะอ่อนแรงลงทีละน้อย', art: { plan: 'serpent', c1: '#4a9a6a', c2: '#c8f0d0', c3: '#e8ff9a', pat: 'diamonds', eye: '#e8ff9a' },
    ability: { kind: 'venom', name: 'เขี้ยวหยก', every: 1.8, power: 0.34, range: 300 },
    text: (v) => `ทุก ${v.every} วินาที ฉกด้วยพิษ ×${v.power.toFixed(2)} ศัตรูติดพิษต่อเนื่อง`,
  },
  star_owlet: {
    id: 'star_owlet', name: 'ลูกนกฮูกดาว', rarity: 'rare', role: 'ช่วยโจมตีวงกว้าง', sprite: 'pet_star_owlet', flying: true,
    desc: 'เรียกดาวดวงเล็กๆ ให้ตกใส่ฝูงศัตรู', art: { plan: 'bird', c1: '#2f3a6a', c2: '#c8d2f4', c3: '#fff3a0', crest: 'ears', beak: 'hook', wing: 'feather', pat: 'stars', glow: true },
    ability: { kind: 'rain', name: 'ฝนดาว', every: 6, power: 0.5, count: 4, r: 60 },
    text: (v) => `ทุก ${v.every} วินาที ดาว ${v.count} ดวงตกรอบศัตรู ดวงละ ×${v.power.toFixed(2)}`,
  },
  moss_golem: {
    id: 'moss_golem', name: 'โกเลมมอส', rarity: 'rare', role: 'ช่วยชีวิต', sprite: 'pet_moss_golem',
    desc: 'ยืนนิ่งเหมือนก้อนหิน แต่จะกระโจนเข้ามาโอบเจ้านายไว้ยามใกล้ตาย', art: { plan: 'golem', c1: '#8a8478', c2: '#b8b0a0', c3: '#9fffd8', moss: '#6aa25a', pat: 'cracks' },
    ability: { kind: 'guardian', name: 'อ้อมกอดหิน', below: 0.3, healPct: 0.3, shieldPct: 0.15 },
    text: (v) => `ครั้งแรกในแต่ละดันเจี้ยนที่พลังชีวิตต่ำกว่า ${pct(v.below)}%: ฟื้น ${pct(v.healPct)}% และได้โล่ ${pct(v.shieldPct)}%`,
  },
  wind_ferret: {
    id: 'wind_ferret', name: 'พังพอนลม', rarity: 'rare', role: 'บัพความเร็วโจมตี', sprite: 'pet_wind_ferret',
    desc: 'วิ่งวนรอบเจ้านายจนเกิดลมหมุน แขนเบาจนฟันได้ถี่ขึ้น', art: { plan: 'quad', c1: '#c8a070', c2: '#f3e6c8', c3: '#9ee0c8', ears: 'round', tail: 'thin', pat: 'stripes', build: 'slim' },
    ability: { kind: 'haste', name: 'ลมหมุน', every: 10, haste: 0.25, duration: 4 },
    text: (v) => `ทุก ${v.every} วินาที ความเร็วโจมตี +${pct(v.haste)}% นาน ${v.duration} วินาที`,
  },
  // ---------------------------------------------------------------- epic
  lava_salamander: {
    id: 'lava_salamander', name: 'ซาลาแมนเดอร์ลาวา', rarity: 'epic', role: 'ไฟพื้น', sprite: 'pet_lava_salamander',
    desc: 'ทุกก้าวที่เดินทิ้งรอยลาวาไว้ ศัตรูที่ตามมาจะไหม้', art: { plan: 'serpent', c1: '#8e2c21', c2: '#ffb35a', c3: '#ffd08a', pat: 'lava', legs: true, fins: true, glow: true },
    ability: { kind: 'trail', name: 'รอยลาวา', every: 0.35, power: 0.22, r: 34, life: 2.6 },
    text: (v) => `เดินทิ้งรอยลาวา: ศัตรูบนรอยโดน ×${v.power.toFixed(2)} ทุกครึ่งวินาที และติดไฟ`,
  },
  storm_eagle: {
    id: 'storm_eagle', name: 'อินทรีพายุ', rarity: 'epic', role: 'พุ่งทะลวง', sprite: 'pet_storm_eagle', flying: true,
    desc: 'พุ่งลงทะลุฝูงศัตรูเร็วเท่าฟ้าผ่า แล้วบินวกกลับมาเกาะไหล่', art: { plan: 'bird', c1: '#5a6a80', c2: '#e8f0ff', c3: '#ffe65a', wing: 'storm', beak: 'hook', crest: 'plume', tailF: 'fan' },
    ability: { kind: 'pierce', name: 'ดิ่งพายุ', every: 3.2, power: 0.9, len: 300, width: 44 },
    text: (v) => `ทุก ${v.every} วินาที พุ่งทะลุแนวศัตรู ×${v.power.toFixed(2)} แล้วกลับมา`,
  },
  prism_sprite: {
    id: 'prism_sprite', name: 'ภูตปริซึม', rarity: 'epic', role: 'ยิงทะลุ', sprite: 'pet_prism_sprite', flying: true,
    desc: 'หักเหแสงออกเป็นลำทะลวงหลายสาย', art: { plan: 'wisp', form: 'prism', c1: '#c8e8ff', c2: '#ffd0f0', c3: '#fff3a0', orbit: true },
    ability: { kind: 'fan', name: 'แสงหักเห', every: 3, power: 0.42, count: 3, spread: 46 },
    text: (v) => `ทุก ${v.every} วินาที ยิงแสง ${v.count} สาย ×${v.power.toFixed(2)} ทะลุศัตรู`,
  },
  shadow_cat: {
    id: 'shadow_cat', name: 'แมวเงา', rarity: 'epic', role: 'ปลิดชีพ', sprite: 'pet_shadow_cat',
    desc: 'หายตัวไปในเงา แล้วโผล่หลังศัตรูที่บาดเจ็บที่สุด', art: { plan: 'quad', c1: '#2a2438', c2: '#5a4a7a', c3: '#c27ff0', ears: 'pointy', tail: 'thin', eye: '#ffe65a', pat: 'none', glow: true, build: 'slim' },
    ability: { kind: 'ambush', name: 'เงาปลิดชีพ', every: 4, power: 1.1, execute: 0.5 },
    text: (v) => `ทุก ${v.every} วินาที วาร์ปไปตะปบศัตรูที่เลือดน้อยที่สุด ×${v.power.toFixed(2)} (เลือดต่ำกว่า 30% แรงขึ้น ${pct(v.execute)}%)`,
  },
  sun_scarab: {
    id: 'sun_scarab', name: 'แมลงสุริยะ', rarity: 'epic', role: 'โคจรรอบตัว', sprite: 'pet_sun_scarab', flying: true,
    desc: 'โคจรรอบเจ้านายเหมือนดวงอาทิตย์ดวงเล็ก ใครเข้าใกล้จะไหม้', art: { plan: 'insect', form: 'beetle', c1: '#2f6a6a', c2: '#7fd0c0', c3: '#f5d48a', sun: true, horn: 'pincer', glow: true },
    ability: { kind: 'orbit', name: 'วงโคจรสุริยะ', power: 0.3, radius: 86, speed: 3.2, hitEvery: 0.35 },
    text: (v) => `โคจรรอบตัวตลอดเวลา ศัตรูที่โดนรับ ×${v.power.toFixed(2)}`,
  },
  bone_hound: {
    id: 'bone_hound', name: 'หมาโครงกระดูก', rarity: 'epic', role: 'ขู่ขวัญ', sprite: 'pet_bone_hound',
    desc: 'เสียงหอนจากโลกหลังความตาย ศัตรูถึงกับตัวแข็ง', art: { plan: 'quad', c1: '#d8ccb6', c2: '#f3ead2', c3: '#9fffd8', ears: 'pointy', tail: 'bone', pat: 'ribs', skull: true, eye: '#9fffd8', build: 'slim' },
    ability: { kind: 'howl', name: 'หอนวิญญาณ', every: 12, r: 190, stun: 0.7, reduce: 0.2, duration: 4 },
    text: (v) => `ทุก ${v.every} วินาที ศัตรูรอบตัวชะงัก ${v.stun} วินาที · เรารับดาเมจ −${pct(v.reduce)}% นาน ${v.duration} วินาที`,
  },
  cloud_whale: {
    id: 'cloud_whale', name: 'วาฬเมฆ', rarity: 'epic', role: 'ฟื้นฟู + ควบคุม', sprite: 'pet_cloud_whale', flying: true,
    desc: 'ลอยอยู่เหนือหัวแล้วโปรยฝนอุ่นๆ ลงมา', art: { plan: 'fish', form: 'whale', c1: '#8fb8e8', c2: '#f4faff', c3: '#c8e8ff', clouds: true },
    ability: { kind: 'drizzle', name: 'ฝนโปรย', every: 10, healPct: 0.05, r: 200, slow: 0.65 },
    text: (v) => `ทุก ${v.every} วินาที ฝนตก 3 วินาที: ฟื้น ${pct(v.healPct)}% และศัตรูในรัศมีช้าลง`,
  },
  void_jelly: {
    id: 'void_jelly', name: 'แมงกะพรุนห้วงว่าง', rarity: 'epic', role: 'กันกระสุน', sprite: 'pet_void_jelly', flying: true,
    desc: 'กลืนทุกอย่างที่ลอยเข้ามาใกล้เจ้านาย รวมถึงกระสุนเวท', art: { plan: 'blob', c1: '#6a4aa8', c2: '#c8b8ff', c3: '#9fffd8', tentacles: 5, core: true, clear: true, glow: true },
    ability: { kind: 'absorb', name: 'กลืนห้วงว่าง', every: 0.25, r: 95, max: 3 },
    text: (v) => `กลืนกระสุนศัตรูที่เข้าใกล้ตัวเราในระยะ ${v.r} ได้ ${v.max} ลูกทุก 6 วินาที`,
  },
  // ---------------------------------------------------------------- legendary
  phoenix_chick: {
    id: 'phoenix_chick', name: 'ลูกนกฟีนิกซ์', rarity: 'legendary', role: 'ชุบชีวิต + ไฟ', sprite: 'pet_phoenix_chick', flying: true,
    desc: 'ไฟของมันไม่เคยดับ และไม่ยอมให้เจ้านายดับก่อน', art: { plan: 'bird', c1: '#ff7a33', c2: '#ffe0a0', c3: '#ffcf5a', wing: 'flame', crest: 'flame', tailF: 'long', glow: true, eye: '#5a1a0a' },
    ability: { kind: 'rebirth', name: 'เถ้าคืนชีพ', every: 6, power: 0.5, r: 120 },
    text: (v) => `ครั้งแรกในแต่ละดันเจี้ยนที่จะล้ม ฟื้นด้วยพลังชีวิต 50% · ทุก ${v.every} วินาที วงไฟรอบตัวเรา ×${v.power.toFixed(2)}`,
  },
  abyss_kraken: {
    id: 'abyss_kraken', name: 'คราเคนห้วงลึก', rarity: 'legendary', role: 'จับตรึง', sprite: 'pet_abyss_kraken', flying: true,
    desc: 'หนวดจากความมืดใต้ทะเลรัดศัตรูได้ทีละหลายตัว', art: { plan: 'blob', c1: '#2a4a6a', c2: '#7fa8d0', c3: '#7fe8ff', tentacles: 7, mouth: 'fang', spikes: true, eye: '#7fe8ff' },
    ability: { kind: 'grasp', name: 'หนวดห้วงลึก', every: 5, power: 0.6, count: 3, stun: 1, range: 320 },
    text: (v) => `ทุก ${v.every} วินาที รัดศัตรู ${v.count} ตัว ×${v.power.toFixed(2)} ตรึงไว้ ${v.stun} วินาที`,
  },
  celestial_qilin: {
    id: 'celestial_qilin', name: 'กิเลนสวรรค์', rarity: 'legendary', role: 'เขตศักดิ์สิทธิ์ + ค่าสถานะ', sprite: 'pet_celestial_qilin',
    desc: 'ที่ใดที่กิเลนเหยียบ ที่นั่นกลายเป็นแดนศักดิ์สิทธิ์', art: { plan: 'quad', c1: '#f5d48a', c2: '#fff6e0', c3: '#7fd0c0', ears: 'droop', horns: 'antler', tail: 'bushy', mane: '#ff8a7a', pat: 'runes', glow: true },
    ability: { kind: 'sanctuary', name: 'แดนกิเลน', every: 15, r: 135, duration: 4, reduce: 0.35, healPct: 0.03, allPct: 0.04 },
    text: (v) => `ทุก ${v.every} วินาที สร้างแดนศักดิ์สิทธิ์ ${v.duration} วินาที: ในวงรับดาเมจ −${pct(v.reduce)}% ฟื้น ${pct(v.healPct)}%/วินาที · ค่าสถานะทั้งหมด +${pct(v.allPct)}%`,
  },
  nine_tail: {
    id: 'nine_tail', name: 'จิ้งจอกเก้าหาง', rarity: 'legendary', role: 'ไฟจิ้งจอก', sprite: 'pet_nine_tail',
    desc: 'หางทั้งเก้าจุดไฟวิญญาณพร้อมกัน แล้วปล่อยให้มันไล่ล่าศัตรูเอง', art: { plan: 'quad', c1: '#f3f0ff', c2: '#ffffff', c3: '#7f9fff', ears: 'pointy', tail: 'nine', pat: 'none', eye: '#7f5fd0', glow: true },
    ability: { kind: 'foxfire', name: 'ไฟจิ้งจอกเก้าดวง', every: 4.5, power: 0.3, count: 9 },
    text: (v) => `ทุก ${v.every} วินาที ปล่อยไฟจิ้งจอก ${v.count} ดวงไล่ตามศัตรู ดวงละ ×${v.power.toFixed(2)}`,
  },
  obsidian_titan: {
    id: 'obsidian_titan', name: 'ไททันออบซิเดียน', rarity: 'legendary', role: 'แผ่นดินไหว + ป้องกัน', sprite: 'pet_obsidian_titan',
    desc: 'ก้าวเดียวของมันทำให้พื้นแยกเป็นสามระลอก', art: { plan: 'golem', c1: '#2a2430', c2: '#5a4a6a', c3: '#ff5a3a', shards: true, pat: 'cracks', glow: true },
    ability: { kind: 'quake', name: 'สามระลอกปฐพี', every: 6, power: 0.55, r: 210, stun: 0.5, defPct: 0.06 },
    text: (v) => `ทุก ${v.every} วินาที แผ่นดินไหว 3 ระลอก ระลอกละ ×${v.power.toFixed(2)} · ป้องกัน +${pct(v.defPct)}%`,
  },
});
