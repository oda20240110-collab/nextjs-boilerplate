import React, { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { QRCodeCanvas } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

// --- Minimal Leaflet icon fix (since default icons aren't bundled) ---
import L from "leaflet";
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
const DefaultIcon = L.icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25,41], iconAnchor: [12,41] });
L.Marker.prototype.options.icon = DefaultIcon;

// --- i18n ---
const t = (lang, key) => ({
  ja: {
    title: "御城印マップ",
    subtitle: "御城印がもらえるお城を地図で検索",
    search: "検索",
    region: "地方",
    prefecture: "都道府県",
    all: "すべて",
    data: "データ",
    addFromCSV: "CSV読み込み",
    qr: "QRコード",
    openHere: "このページを開く",
    lang: "言語",
    stampAvailable: "御城印あり",
    moreInfo: "詳細",
    filter: "絞り込み",
  },
  en: {
    title: "Gojoin Castle Map",
    subtitle: "Find castles offering Gojoin (castle stamps)",
    search: "Search",
    region: "Region",
    prefecture: "Prefecture",
    all: "All",
    data: "Data",
    addFromCSV: "Import CSV",
    qr: "QR Code",
    openHere: "Open this page",
    lang: "Language",
    stampAvailable: "Gojoin available",
    moreInfo: "Details",
    filter: "Filter",
  },
  zh: {
    title: "御城印地图",
    subtitle: "在地图上查找可领取御城印的城堡",
    search: "搜索",
    region: "地区",
    prefecture: "都道府县",
    all: "全部",
    data: "数据",
    addFromCSV: "导入CSV",
    qr: "二维码",
    openHere: "打开此页面",
    lang: "语言",
    stampAvailable: "可领取御城印",
    moreInfo: "详情",
    filter: "筛选",
  },
}[lang][key]);

// --- Regions & Prefectures ---
const PREFS = {
  北海道・東北: ["北海道","青森","岩手","宮城","秋田","山形","福島"],
  関東: ["東京","神奈川","千葉","埼玉","茨城","栃木","群馬"],
  甲信越: ["山梨","長野","新潟"],
  北陸: ["富山","石川","福井"],
  東海: ["静岡","愛知","岐阜","三重"],
  近畿: ["京都","滋賀","大阪","兵庫","奈良","和歌山"],
  中国: ["鳥取","島根","岡山","広島","山口"],
  四国: ["香川","徳島","愛媛","高知"],
  九州・沖縄: ["福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"],
};

// --- Seed dataset (verified examples). You can expand/replace via CSV import. ---
// Fields: id, name_ja, name_en, name_zh, prefecture, region, lat, lng, url, gojoin_url
const SEED = [
  {
    id: "matsumoto",
    name_ja: "松本城",
    name_en: "Matsumoto Castle",
    name_zh: "松本城",
    prefecture: "長野",
    region: "甲信越",
    lat: 36.2381,
    lng: 137.9680,
    url: "https://www.matsumoto-castle.jp/",
    gojoin_url: "https://www.matsumoto-castle.jp/topics/8063.html"
  },
  {
    id: "kumamoto",
    name_ja: "熊本城",
    name_en: "Kumamoto Castle",
    name_zh: "熊本城",
    prefecture: "熊本",
    region: "九州・沖縄",
    lat: 32.8067,
    lng: 130.7056,
    url: "https://castle.kumamoto-guide.jp/",
    gojoin_url: "https://kumamoto-icb.or.jp/%E7%86%8A%E6%9C%AC%E5%9F%8E%E3%80%8C%E5%BE%A1%E5%9F%8E%E5%8D%B0%E3%80%8D%E3%81%AE%E3%81%94%E7%B4%B9%E4%BB%8B/"
  },
  {
    id: "hirosaki",
    name_ja: "弘前城",
    name_en: "Hirosaki Castle",
    name_zh: "弘前城",
    prefecture: "青森",
    region: "北海道・東北",
    lat: 40.6081,
    lng: 140.4612,
    url: "https://www.hirosakipark.jp/",
    gojoin_url: "https://www.hirosakipark.jp/sakura/cherryblossomfestival/souvenir/goshuin/"
  },
  {
    id: "himeji",
    name_ja: "姫路城",
    name_en: "Himeji Castle",
    name_zh: "姬路城",
    prefecture: "兵庫",
    region: "近畿",
    lat: 34.8394,
    lng: 134.6939,
    url: "https://www.city.himeji.lg.jp/castle/",
    gojoin_url: "https://www.himeji-kanko.jp/event/1612/"
  },
  {
    id: "hamamatsu",
    name_ja: "浜松城",
    name_en: "Hamamatsu Castle",
    name_zh: "滨松城",
    prefecture: "静岡",
    region: "東海",
    lat: 34.7179,
    lng: 137.7238,
    url: "https://hamamatsu-jyo.jp/",
    gojoin_url: "https://shizuoka.hellonavi.jp/gojyoin"
  },
];

// CSV schema example (UTF-8):
// id,name_ja,name_en,name_zh,prefecture,region,lat,lng,url,gojoin_url

function useHashState(key, initial) {
  // Persist small preferences in URL hash so the QR code captures them
  const [state, setState] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace('#','?'));
    return hash.get(key) || initial;
  });
  useEffect(() => {
    const sp = new URLSearchParams(window.location.hash.replace('#','?'));
    if (state == null) sp.delete(key); else sp.set(key, state);
    const s = sp.toString();
    window.location.hash = s ? s : "";
  }, [key, state]);
  return [state, setState];
}

export default function App() {
  const [lang, setLang] = useHashState("lang", "ja");
  const [q, setQ] = useHashState("q", "");
  const [region, setRegion] = useHashState("region", "");
  const [pref, setPref] = useHashState("pref", "");
  const [data, setData] = useState(SEED);

  // Filtering
  const filtered = useMemo(() => {
    return data.filter(d => {
      if (region && d.region !== region) return false;
      if (pref && d.prefecture !== pref) return false;
      if (q) {
        const s = `${d.name_ja} ${d.name_en} ${d.name_zh}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, q, region, pref]);

  // Map center (Japan)
  const center = [36.2048, 138.2529];

  // CSV import (optional)
  const onCSV = async (file) => {
    const text = await file.text();
    // Very small CSV parser (no quotes). For robust parsing, use PapaParse.
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(',');
    const rows = lines.map(line => {
      const cols = line.split(',');
      const o = {}; headers.forEach((h,i)=> o[h.trim()] = cols[i]?.trim());
      return {
        id: o.id,
        name_ja: o.name_ja,
        name_en: o.name_en,
        name_zh: o.name_zh,
        prefecture: o.prefecture,
        region: o.region,
        lat: parseFloat(o.lat),
        lng: parseFloat(o.lng),
        url: o.url,
        gojoin_url: o.gojoin_url,
      };
    }).filter(r=>!Number.isNaN(r.lat) && !Number.isNaN(r.lng));
    setData(rows.length ? rows : SEED);
  };

  const LangSwitcher = (
    <div className="flex items-center gap-2">
      <span className="text-sm opacity-70">{t(lang, 'lang')}</span>
      <Select value={lang} onValueChange={setLang}>
        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ja">日本語</SelectItem>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="zh">中文</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const RegionSelect = (
    <Select value={region} onValueChange={(v)=>{ setRegion(v); setPref(""); }}>
      <SelectTrigger className="w-40"><SelectValue placeholder={t(lang,'region')} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="">{t(lang,'all')}</SelectItem>
        {Object.keys(PREFS).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const PrefSelect = (
    <Select value={pref} onValueChange={setPref}>
      <SelectTrigger className="w-40"><SelectValue placeholder={t(lang,'prefecture')} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="">{t(lang,'all')}</SelectItem>
        {(region ? PREFS[region] : Object.values(PREFS).flat()).map(p => (
          <SelectItem key={p} value={p}>{p}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">{t(lang,'title')}</h1>
            <p className="text-slate-600">{t(lang,'subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">{LangSwitcher}</div>
        </div>

        <Card className="mb-4 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              <div className="md:col-span-2">
                <Input value={q} onChange={e=>setQ(e.target.value)} placeholder={`${t(lang,'search')}...`} />
              </div>
              <div className="flex gap-3">{RegionSelect}{PrefSelect}</div>
              <div className="flex items-center gap-3">
                <label className="text-sm opacity-70">{t(lang,'addFromCSV')}</label>
                <input type="file" accept=".csv" onChange={e=>e.target.files && onCSV(e.target.files[0])} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm opacity-70">{t(lang,'qr')}</span>
                <QRCodeCanvas value={window.location.href} size={72} includeMargin className="rounded bg-white p-1" />
                <Button onClick={()=>navigator.clipboard.writeText(window.location.href)} variant="secondary" className="rounded-2xl">{t(lang,'openHere')}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.4}} className="md:col-span-2 order-2 md:order-1">
            <div className="h-[70vh] w-full rounded-2xl overflow-hidden shadow">
              <MapContainer center={center} zoom={5} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filtered.map(c => (
                  <Marker key={c.id} position={[c.lat, c.lng]}>
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-bold text-lg">{lang==='ja'?c.name_ja:lang==='en'?c.name_en:c.name_zh}</div>
                        <div className="text-xs text-green-700">✅ {t(lang,'stampAvailable')}</div>
                        <div className="text-sm text-slate-600">{c.prefecture} / {c.region}</div>
                        <div className="flex gap-2 pt-1">
                          <a className="underline text-blue-600" href={c.url} target="_blank" rel="noreferrer">Official</a>
                          <a className="underline text-blue-600" href={c.gojoin_url} target="_blank" rel="noreferrer">{t(lang,'moreInfo')}</a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.4}} className="order-1 md:order-2">
            <Card className="sticky top-4">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">{t(lang,'filter')}</h3>
                <div className="space-y-2">
                  <div>{RegionSelect}</div>
                  <div>{PrefSelect}</div>
                </div>
                <hr className="my-4" />
                <h3 className="font-semibold mb-2">{t(lang,'data')}</h3>
                <p className="text-sm text-slate-600 mb-2">CSV: id,name_ja,name_en,name_zh,prefecture,region,lat,lng,url,gojoin_url</p>
                <ul className="max-h-64 overflow-auto text-sm space-y-2">
                  {filtered.map(c => (
                    <li key={c.id} className="p-2 bg-slate-50 rounded border">
                      <div className="font-medium">{c.name_ja} / {c.name_en}</div>
                      <div className="text-xs text-slate-500">{c.prefecture}・{c.region}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <footer className="text-xs text-slate-500 mt-6">
          Data seed includes: Matsumoto, Kumamoto, Hirosaki, Himeji, Hamamatsu. Add more via CSV. Tiles © OpenStreetMap. Icons © Leaflet.
        </footer>
      </div>
    </div>
  );
}
