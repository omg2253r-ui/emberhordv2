# Emberhold Wiki (/wiki/)
หน้าคลังข้อมูลทุกหมวดของเกม สร้างข้อมูลจากโค้ดเกมโดยตรง ไม่ต้องแก้มือ

- `tools/gen-wiki.mjs` อ่าน `src/data/*` (อาวุธ ไอเทม สัตว์เลี้ยง สกิล เผ่า อัลติเมท ด่าน บอส หอคอย ฯลฯ) → `wiki/data.json`
- `tools/build-site.mjs` เรียกสคริปต์นี้ทุกครั้งที่ Netlify build → deploy เกมใหม่ = เว็บคลังข้อมูลอัปเดตเอง
- หน้าเว็บดึง `data.json` ซ้ำทุก 5 นาที/ตอนกลับมาที่แท็บ ถ้าเกมถูก deploy ใหม่จะวาดใหม่เองโดยไม่ต้องรีเฟรช
- ปรับเทียร์อาวุธ: แก้ `TIER_CUTS` ใน `tools/gen-wiki.mjs`
- ทดสอบในเครื่อง: `node tools/gen-wiki.mjs && npx serve .` แล้วเปิด /wiki/
