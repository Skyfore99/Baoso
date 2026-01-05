// @ts-nocheck
/* eslint-disable */
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Settings,
  HelpCircle,
  Save,
  RotateCcw,
  Edit3,
  ClipboardList,
  CheckCircle,
  X,
  Search,
  Code,
  Link as LinkIcon,
  Copy,
  Loader2,
  Box,
  ShoppingBag,
  Tag,
  Palette,
  Calculator,
  Hash,
  Filter,
  Plus,
  List,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Layers,
  Zap,
  Trash2,
  ChevronDown,
  Database, // ⚡ NEW: Icon cho cache
} from "lucide-react";

// --- CONFIG ---
const HARDCODED_API_URL = "";

// ⚡ CACHE KEYS - NEW
const CACHE_KEYS = {
  ITEMS: "bao_so_cached_items",
  TIME: "bao_so_cache_time",
  API_URL: "gas_api_url",
};

// --- BACKEND SCRIPT TEMPLATE ---
const BACKEND_SCRIPT = `const SHEET_DATA = "Data";
const SHEET_CONFIG = "Config";
const CACHE_KEY = "config_v1";
const CACHE_TTL = 300; // 5 phút

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const doc = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "add") {
      let sheet = doc.getSheetByName(SHEET_DATA);
      if (!sheet) { 
        sheet = doc.insertSheet(SHEET_DATA); 
        sheet.appendRow(["Thời gian", "PO", "Đơn hàng", "Mã hàng", "Style", "Màu", "ShipDate", "Nhóm", "Số lượng"]); 
      }
      
      const qty = parseFloat(request.qty);
      const limit = parseFloat(request.limit) || 0; 
      const currentTotal = getCumulative(sheet, request.po, request.ma, request.mau, request.style, request.don);
      const newTotal = parseFloat((currentTotal + qty).toFixed(2));
      
      if (limit > 0 && (newTotal > limit)) {
        return responseJSON({ status: "error", message: "Vượt KH! (" + newTotal + "/" + limit + ")" });
      }
      
      sheet.appendRow([new Date(), "'" + request.po, request.don, request.ma, request.style, request.mau, request.shipdate, request.nhom, qty]);
      updateConfigSheet(doc, request, newTotal);
      CacheService.getScriptCache().remove(CACHE_KEY); // Clear cache
      return responseJSON({ status: "success", total: newTotal, msg: request.style + ' (' + request.mau + ')' });
    }
    else if (action === "get_config") {
      return handleGetConfigCached(doc);
    }
    else if (action === "get_summary") {
      let sheet = doc.getSheetByName(SHEET_DATA);
      return responseJSON({ status: "success", data: getDailyData(sheet, request.date, doc.getSpreadsheetTimeZone()) });
    }
  } catch (error) { return responseJSON({ status: "error", message: error.toString() }); } 
  finally { lock.releaseLock(); }
}

function handleGetConfigCached(doc) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY);
  if (cached) return responseJSON(JSON.parse(cached));
  const result = handleGetConfig(doc);
  try {
    const obj = JSON.parse(result.getContent());
    if (obj.status === "success") cache.put(CACHE_KEY, JSON.stringify(obj), CACHE_TTL);
  } catch(e) {}
  return result;
}

function updateConfigSheet(doc, request, newTotal) {
  try {
    let sheetConfig = doc.getSheetByName(SHEET_CONFIG);
    if (sheetConfig) {
       const lastRow = sheetConfig.getLastRow();
       if (lastRow >= 2) {
           const configValues = sheetConfig.getRange(2, 1, lastRow - 1, 5).getValues();
           for (let i = 0; i < configValues.length; i++) {
               if (String(configValues[i][0]) === String(request.ma) && 
                   String(configValues[i][1]) === String(request.style) &&
                   String(configValues[i][2]) === String(request.mau) &&
                   String(configValues[i][3]) === String(request.don) && 
                   String(configValues[i][4]) === String(request.po)) {
                   if (request.nhom) sheetConfig.getRange(i + 2, 8).setValue(request.nhom);
                   sheetConfig.getRange(i + 2, 9).setValue(newTotal);
                   break; 
               }
           }
       }
    }
  } catch(e) {}
}

function handleGetConfig(doc) {
  let sheetConfig = doc.getSheetByName(SHEET_CONFIG);
  if (!sheetConfig) return responseJSON({ status: "success", items: [] });
  const lastRow = sheetConfig.getLastRow();
  if (lastRow < 2) return responseJSON({ status: "success", items: [] });
  const configData = sheetConfig.getRange(2, 1, lastRow - 1, 10).getValues();
  let sheetData = doc.getSheetByName(SHEET_DATA);
  const totals = {};
  if (sheetData && sheetData.getLastRow() >= 2) {
    const dataValues = sheetData.getRange(2, 1, sheetData.getLastRow() - 1, 9).getValues();
    for (let i = 0; i < dataValues.length; i++) {
      let poRaw = String(dataValues[i][1]);
      if(poRaw.startsWith("'")) poRaw = poRaw.substring(1);
      const key = poRaw + "_" + String(dataValues[i][3]) + "_" + String(dataValues[i][5]) + "_" + String(dataValues[i][4]) + "_" + String(dataValues[i][2]);
      totals[key] = (totals[key] || 0) + (Number(dataValues[i][8]) || 0);
    }
  }
  const items = configData.map(r => {
    let shipdate = r[5];
    if (shipdate instanceof Date) shipdate = Utilities.formatDate(shipdate, Session.getScriptTimeZone(), "dd/MM/yyyy");
    else shipdate = String(shipdate || "");
    const po = String(r[4]); const ma = String(r[0]); const mau = String(r[2]); const style = String(r[1]); const don = String(r[3]);
    const key = po + "_" + ma + "_" + mau + "_" + style + "_" + don;
    const xuatDu = String(r[9] || "").toLowerCase().trim();
    return { ma, style, mau, don, po, shipdate, kh: Number(r[6]) || 0, nhom: String(r[7] || ""), current: totals[key] || 0, xuatDu };
  }).filter(item => item.ma);
  return responseJSON({ status: "success", items: items });
}

function responseJSON(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function getCumulative(sheet, po, ma, mau, style, don) {
  const data = sheet.getDataRange().getValues();
  let total = 0;
  for (let i = 1; i < data.length; i++) {
    let rowPO = String(data[i][1]);
    if(rowPO.startsWith("'")) rowPO = rowPO.substring(1);
    if (rowPO==String(po) && String(data[i][3])==String(ma) && String(data[i][5])==String(mau) && String(data[i][4])==String(style) && String(data[i][2])==String(don)) {
      total += Number(data[i][8]);
    }
  }
  return total;
}

function getDailyData(sheet, dateString, timezone) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const results = [], totalsMap = {}, dailyNkMap = {};
  for (let i = 1; i < data.length; i++) {
     let p = String(data[i][1]); if(p.startsWith("'")) p = p.substring(1);
     let key = p + "_" + data[i][3] + "_" + data[i][5] + "_" + data[i][4] + "_" + data[i][2];
     const val = Number(data[i][8]) || 0;
     totalsMap[key] = (totalsMap[key] || 0) + val;
     const rowDate = new Date(data[i][0]);
     const rowDateStr = Utilities.formatDate(rowDate, timezone, "yyyy-MM-dd");
     if (rowDateStr === dateString) dailyNkMap[key] = (dailyNkMap[key] || 0) + val;
  }
  const seenKeys = {};
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = new Date(data[i][0]);
    const rowDateStr = Utilities.formatDate(rowDate, timezone, "yyyy-MM-dd");
    if (rowDateStr === dateString) {
      let rowPO = String(data[i][1]);
      if(rowPO.startsWith("'")) rowPO = rowPO.substring(1);
      let key = rowPO + "_" + data[i][3] + "_" + data[i][5] + "_" + data[i][4] + "_" + data[i][2];
      if (!seenKeys[key]) {
        seenKeys[key] = true;
        let rowShip = data[i][6];
        if (rowShip instanceof Date) rowShip = Utilities.formatDate(rowShip, Session.getScriptTimeZone(), "dd/MM/yyyy");
        results.push({ time: Utilities.formatDate(rowDate, timezone, "HH:mm"), po: rowPO, don: data[i][2], ma: data[i][3], style: data[i][4], mau: data[i][5], shipdate: rowShip, nhom: data[i][7], nk: dailyNkMap[key] || 0, qty: totalsMap[key] || 0 });
      }
    }
  }
  return results;
}`;

// --- COMPONENTS ---
// @ts-ignore
const Toast = ({ msg, type, show, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-white text-sm font-medium z-[60] transition-all duration-300 flex items-center gap-2 ${
        type === "error" ? "bg-red-500" : "bg-slate-800"
      }`}
    >
      {type === "error" ? (
        <AlertTriangle size={14} />
      ) : (
        <CheckCircle size={14} />
      )}
      {msg}
    </div>
  );
};

// @ts-ignore
const Modal = ({ isOpen, onClose, title, icon: Icon, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            {Icon && <Icon size={18} className="text-blue-500" />} {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition text-slate-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("input");
  const [showConfig, setShowConfig] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [loadingReport, setLoadingReport] = useState(false);

  const [masterItems, setMasterItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [showAllInput, setShowAllInput] = useState(false);

  // ⚡ NEW: Cache status state
  const [cacheStatus, setCacheStatus] = useState({
    hasCache: false,
    cacheTime: null,
  });

  const [filters, setFilters] = useState({
    ma: "",
    mau: "",
    don: "",
    po: "",
    shipdate: "",
    style: "",
  });

  const [persistentGroup, setPersistentGroup] = useState("");
  const [showGroupList, setShowGroupList] = useState(false);
  const [qty, setQty] = useState("");

  const [availableGroups, setAvailableGroups] = useState([]);
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportData, setReportData] = useState([]);
  const [reportFilterMa, setReportFilterMa] = useState("");
  const [reportFilterPo, setReportFilterPo] = useState(""); // ⚡ NEW: PO filter

  // ⚡ NEW: Report cache by date
  const [reportCache, setReportCache] = useState({});

  const [toast, setToast] = useState({ show: false, msg: "", type: "info" });
  const qtyInputRef = useRef(null);

  const isFiltering = Object.values(filters).some(
    (f) => f && String(f).trim() !== ""
  );

  useEffect(() => {
    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
    if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    const style = document.createElement("style");
    style.innerHTML = `
      html, body { height: 100%; overflow: hidden; }
      body { font-family: 'Inter', sans-serif; overscroll-behavior: none; } 
      * { -webkit-tap-highlight-color: transparent; }
      ::-webkit-scrollbar { width: 5px; height: 5px; } 
      ::-webkit-scrollbar-track { background: transparent; } 
      ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      .custom-scrollbar { -webkit-overflow-scrolling: touch; }
      @media screen and (max-width: 768px) {
        input, select, textarea { font-size: 16px !important; }
      }
    `;
    document.head.appendChild(style);

    const savedUrl =
      localStorage.getItem(CACHE_KEYS.API_URL) || HARDCODED_API_URL;
    if (savedUrl) {
      setApiUrl(savedUrl);
      loadConfig(savedUrl, false);
    } else {
      setShowConfig(true);
    }

    // ⚡ NEW: Check cache status on mount
    checkCacheStatus();
  }, []);

  useEffect(() => {
    if (masterItems.length > 0) {
      const groups = [
        ...new Set(masterItems.map((i) => i.nhom).filter(Boolean)),
      ];
      setAvailableGroups(groups);
    }
  }, [masterItems]);

  useEffect(() => {
    let interval;
    if (connectionStatus === "connected" && apiUrl) {
      interval = setInterval(() => {
        loadConfig(apiUrl, true);
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [connectionStatus, apiUrl]);

  useEffect(() => {
    setShowAllInput(false);
  }, [filters]);

  const filteredItems = useMemo(() => {
    if (masterItems.length === 0) return [];
    return masterItems.filter((item) => {
      return (
        (!filters.ma ||
          item.ma.toLowerCase().includes(filters.ma.toLowerCase())) &&
        (!filters.style ||
          item.style.toLowerCase().includes(filters.style.toLowerCase())) &&
        (!filters.mau ||
          item.mau.toLowerCase().includes(filters.mau.toLowerCase())) &&
        (!filters.don ||
          item.don.toLowerCase().includes(filters.don.toLowerCase())) &&
        (!filters.po ||
          item.po.toLowerCase().includes(filters.po.toLowerCase())) &&
        (!filters.shipdate ||
          item.shipdate.toLowerCase().includes(filters.shipdate.toLowerCase()))
      );
    });
  }, [filters, masterItems]);

  const itemsToDisplay = showAllInput
    ? filteredItems
    : filteredItems.slice(0, 50);

  useEffect(() => {
    if (activeTab === "report") fetchReport();
  }, [activeTab, reportDate]);

  const showToast = (msg, type = "info") => setToast({ show: true, msg, type });
  const formatDecimal = (num) =>
    num === undefined || num === null || num === ""
      ? "0.00"
      : parseFloat(num).toFixed(2);

  const fetchGAS = async (url, payload) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      return await response.json();
    } catch (error) {
      throw new Error("Lỗi kết nối Server");
    }
  };

  // ⚡ NEW: Check cache status helper
  const checkCacheStatus = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.ITEMS);
      const cacheTime = localStorage.getItem(CACHE_KEYS.TIME);

      if (cached && cacheTime) {
        setCacheStatus({
          hasCache: true,
          cacheTime: new Date(parseInt(cacheTime)),
        });
      } else {
        setCacheStatus({ hasCache: false, cacheTime: null });
      }
    } catch (e) {
      setCacheStatus({ hasCache: false, cacheTime: null });
    }
  };

  // ⚡ NEW: Clear cache function
  const clearCache = () => {
    try {
      localStorage.removeItem(CACHE_KEYS.ITEMS);
      localStorage.removeItem(CACHE_KEYS.TIME);
      setCacheStatus({ hasCache: false, cacheTime: null });
      showToast("Đã xóa cache", "success");
      // Reload data from server
      if (apiUrl) loadConfig(apiUrl, false);
    } catch (e) {
      showToast("Lỗi xóa cache", "error");
    }
  };

  const saveConfig = () => {
    if (!apiUrl.trim()) return showToast("Vui lòng nhập URL", "error");
    localStorage.setItem(CACHE_KEYS.API_URL, apiUrl);
    showToast("Đã lưu cấu hình", "success");
    setShowConfig(false);
    loadConfig(apiUrl, false);
  };

  // ⚡ OPTIMIZED: Load config with localStorage cache
  const loadConfig = async (url, silent = false) => {
    const targetUrl = url || apiUrl;
    if (!targetUrl) return;

    // ⚡ STEP 1: Load from cache first (instant display)
    if (!silent) {
      try {
        const cached = localStorage.getItem(CACHE_KEYS.ITEMS);
        const cacheTime = localStorage.getItem(CACHE_KEYS.TIME);

        if (cached) {
          const parsed = JSON.parse(cached);
          setMasterItems(parsed);
          setConnectionStatus("connected");

          if (cacheTime) {
            const cacheDate = new Date(parseInt(cacheTime));
            setLastSync(cacheDate);
          }

          console.log("✅ Loaded from cache:", parsed.length, "items");
        }
      } catch (e) {
        console.warn("⚠️ Cache load error:", e);
      }
    }

    // ⚡ STEP 2: Fetch from server (update in background)
    if (!silent) {
      setIsConfigLoading(true);
      setSyncStatus("syncing");
    }

    try {
      const res = await fetchGAS(targetUrl, { action: "get_config" });
      if (res.status === "success") {
        setMasterItems(res.items || []);

        // ⚡ Save to localStorage
        if (!silent) {
          try {
            localStorage.setItem(
              CACHE_KEYS.ITEMS,
              JSON.stringify(res.items || [])
            );
            localStorage.setItem(CACHE_KEYS.TIME, Date.now().toString());
            checkCacheStatus();
            console.log("💾 Saved to cache:", res.items?.length, "items");
          } catch (e) {
            console.warn("⚠️ Cache save error:", e);
          }
        }

        if (!silent) {
          setSyncStatus("complete");
          setTimeout(() => setSyncStatus("idle"), 3000);
        }
        setConnectionStatus("connected");
        setLastSync(new Date());
      }
    } catch (e) {
      if (!silent) {
        showToast("Lỗi tải Config", "error");
        setSyncStatus("idle");
      }
    } finally {
      if (!silent) setIsConfigLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.id]: e.target.value }));
    setSelectedItem(null);
  };

  const clearFilters = () => {
    setFilters({ ma: "", mau: "", don: "", po: "", shipdate: "", style: "" });
    setSelectedItem(null);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setQty(""); // ⚡ RESET input khi chọn item khác
    if (item.nhom) {
      setPersistentGroup(item.nhom);
    }
    // ⚡ REMOVED: Auto-focus causes keyboard issues on mobile
    // Only focus manually when user clicks input
  };

  const handleAutoFill = (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    const target = Number(selectedItem.kh);
    if (target > 0) {
      setQty(String(target));
      // ⚡ REMOVED: Auto-focus causes keyboard to open on mobile
      // User can click input if they want to edit
    } else {
      showToast("Không có KH", "info");
    }
  };

  const submitData = async (e) => {
    if (e) e.preventDefault();

    if (!apiUrl) return showToast("Chưa kết nối Backend", "error");
    const currentGroup = persistentGroup;
    let payload = { action: "add", nhom: currentGroup };
    let inputQty = 0;

    if (isManualMode) {
      return;
    } else {
      if (!selectedItem) return showToast("Chưa chọn mã", "error");
      if (!qty) return showToast("Chưa nhập SL", "error");

      const newCumulative = parseFloat(qty);
      const currentCumulative = selectedItem.current || 0;
      inputQty = newCumulative - currentCumulative;

      payload = {
        ...payload,
        po: selectedItem.po,
        don: selectedItem.don,
        ma: selectedItem.ma,
        style: selectedItem.style,
        mau: selectedItem.mau,
        shipdate: selectedItem.shipdate,
        limit: selectedItem.kh,
        qty: inputQty,
      };
    }

    const newTotal = parseFloat(qty);
    const updatedItem = { ...selectedItem, current: newTotal };
    setSelectedItem(updatedItem);
    setMasterItems((prev) =>
      prev.map((i) => (i === selectedItem ? updatedItem : i))
    );
    setQty("");
    showToast("Đã lưu!", "success");

    // ⚡ REMOVED: Auto-focus after submit causes keyboard to open on mobile
    // User can manually select next item and click input when ready

    fetchGAS(apiUrl, payload)
      .then((res) => {
        if (res.status !== "success")
          showToast(res.message || "Lỗi Server!", "error");
      })
      .catch(() => showToast("Lỗi mạng!", "error"));
  };

  const fetchReport = async (forceRefresh = false) => {
    if (!apiUrl) return;

    // ⚡ Check cache first
    if (!forceRefresh && reportCache[reportDate]) {
      console.log("✅ Loaded report from cache:", reportDate);
      setReportData(reportCache[reportDate]);
      setReportFilterMa("");
      setReportFilterPo("");
      return;
    }

    setLoadingReport(true);
    setReportFilterMa("");
    setReportFilterPo("");
    try {
      const res = await fetchGAS(apiUrl, {
        action: "get_summary",
        date: reportDate,
      });
      if (res.status === "success") {
        // ⚡ DEBUG: Check NK values
        console.log("📊 Report data from backend:", {
          total: res.data.length,
          sample: res.data.slice(0, 3), // First 3 items
          hasNK: res.data.some((item) => item.nk > 0),
        });

        setReportData(res.data);

        // ⚡ Save to cache
        setReportCache((prev) => ({
          ...prev,
          [reportDate]: res.data,
        }));

        console.log(
          "💾 Saved report to cache:",
          reportDate,
          res.data.length,
          "items"
        );
      }
    } catch (e) {
      showToast("Lỗi tải báo cáo", "error");
    } finally {
      setLoadingReport(false);
    }
  };

  // ⚡ UPDATED: Cascade filter - chỉ hiển thị options còn available
  const availableReportMas = [
    ...new Set(
      reportData
        .filter((item) => !reportFilterPo || String(item.po) === reportFilterPo)
        .map((item) => String(item.ma || ""))
        .filter(Boolean)
    ),
  ];

  const availableReportPos = [
    ...new Set(
      reportData
        .filter((item) => !reportFilterMa || String(item.ma) === reportFilterMa)
        .map((item) => String(item.po || ""))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));

  // ⚡ Support both filters
  const displayedReportData = reportData.filter((item) => {
    const matchMa = !reportFilterMa || String(item.ma) === reportFilterMa;
    const matchPo = !reportFilterPo || String(item.po) === reportFilterPo;
    return matchMa && matchPo;
  });
  const copyCode = () =>
    navigator.clipboard
      .writeText(BACKEND_SCRIPT)
      .then(() => showToast("Đã copy code"));

  const selectGroup = (g) => {
    setPersistentGroup(g);
    setShowGroupList(false);
  };

  const filteredGroups = persistentGroup
    ? availableGroups.filter((g) =>
        g.toString().toLowerCase().includes(persistentGroup.toLowerCase())
      )
    : availableGroups;

  return (
    <div className="bg-slate-100 min-h-screen w-full flex justify-center items-center font-sans text-slate-800">
      <div className="w-full h-[100dvh] sm:h-[90vh] sm:w-[480px] bg-white sm:rounded-2xl shadow-2xl flex flex-col relative overflow-hidden">
        {/* HEADER */}
        <header className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 z-30 shadow-md sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-900/50">
              BS
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-lg tracking-tight leading-none">
                Báo Số
              </h1>
              <p className="text-[10px] font-medium text-slate-400 opacity-90 leading-tight mt-0.5">
                {syncStatus === "syncing" ? (
                  "Đang đồng bộ..."
                ) : syncStatus === "complete" ? (
                  <span className="text-green-400 font-bold">
                    Đồng bộ xong!
                  </span>
                ) : lastSync ? (
                  `Cập nhật: ${lastSync.toLocaleTimeString()}`
                ) : (
                  "Sẵn sàng"
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadConfig(apiUrl, false)}
              disabled={syncStatus !== "idle"}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                syncStatus === "complete"
                  ? "bg-green-600 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              {syncStatus === "syncing" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : syncStatus === "complete" ? (
                <CheckCircle size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition"
            >
              <Code size={18} className="text-slate-300" />
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                showConfig
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* CONFIG PANEL - ⚡ UPDATED with cache controls */}
        <div
          className={`bg-slate-50 border-b border-slate-200 p-4 absolute top-[64px] left-0 w-full z-30 transition-all duration-300 shadow-lg ${
            showConfig
              ? "translate-y-0"
              : "-translate-y-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase">
              Kết nối Backend
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-100 text-green-700"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              {connectionStatus === "connected" ? "Đã kết nối" : "Chưa kết nối"}
            </span>
          </div>
          <div className="relative">
            <LinkIcon
              size={14}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              type="text"
              value={apiUrl}
              disabled={!!HARDCODED_API_URL}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="URL Web App..."
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={saveConfig}
              disabled={!!HARDCODED_API_URL}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Save size={16} /> Lưu Kết Nối
            </button>
            <button
              onClick={() => loadConfig(apiUrl, false)}
              className="px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* ⚡ NEW: Cache Status & Clear Button */}
          {cacheStatus.hasCache && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-blue-700">
                <Database size={14} />
                <span>
                  Cache: {cacheStatus.cacheTime?.toLocaleTimeString()}
                  <span className="text-blue-500 ml-1">
                    ({masterItems.length} items)
                  </span>
                </span>
              </div>
              <button
                onClick={clearCache}
                className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
              >
                <Trash2 size={12} /> Xóa
              </button>
            </div>
          )}
        </div>

        {/* TABS */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 shrink-0 z-10">
          <div className="flex bg-slate-200/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("input")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === "input"
                  ? "text-blue-700 bg-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Edit3 size={16} /> Nhập Liệu
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === "report"
                  ? "text-blue-700 bg-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ClipboardList size={16} /> Báo Cáo
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* --- INPUT VIEW --- */}
          {activeTab === "input" && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* GROUP INPUT ROW */}
              <div className="px-3 pt-3 pb-1 bg-white shrink-0 z-20 flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1 min-w-[50px]">
                    <Layers size={14} /> Nhóm
                  </div>
                  <div className="relative flex-1 group">
                    <input
                      value={persistentGroup}
                      onChange={(e) => setPersistentGroup(e.target.value)}
                      onFocus={() => setShowGroupList(true)}
                      onBlur={() =>
                        setTimeout(() => setShowGroupList(false), 200)
                      }
                      className="w-full p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-800 focus:outline-none focus:border-blue-500 transition placeholder-blue-300 pr-8"
                      placeholder="Chọn hoặc nhập Nhóm..."
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                      <ChevronDown size={14} />
                    </div>
                    {showGroupList && filteredGroups.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                        {filteredGroups.map((g, i) => (
                          <div
                            key={i}
                            onClick={() => selectGroup(g)}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-0"
                          >
                            {g}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={clearFilters}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition flex items-center justify-center"
                  title="Xoá bộ lọc"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* SELECT FROM LIST */}
              <div className="p-3 bg-white border-b border-slate-100 shrink-0 space-y-2 z-10">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="style"
                    value={filters.style}
                    onChange={handleFilterChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none"
                    placeholder="Style..."
                  />
                  <input
                    id="mau"
                    value={filters.mau}
                    onChange={handleFilterChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none"
                    placeholder="Màu..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="don"
                    value={filters.don}
                    onChange={handleFilterChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none"
                    placeholder="Đơn..."
                  />
                  <input
                    id="po"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={filters.po}
                    onChange={handleFilterChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none uppercase"
                    placeholder="PO..."
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-2 custom-scrollbar">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                    <Search size={24} className="opacity-20" />
                    <span className="text-xs">
                      {isConfigLoading
                        ? "Đang tải dữ liệu..."
                        : "Không tìm thấy"}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pb-20">
                    {itemsToDisplay.map((item, idx) => {
                      const diff = (item.current || 0) - (Number(item.kh) || 0);
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelectItem(item)}
                          onMouseDown={(e) => e.preventDefault()}
                          className={`bg-white p-2 rounded-lg border cursor-pointer transition-all active:scale-[0.98] h-full flex flex-col justify-between ${
                            selectedItem === item
                              ? "border-blue-500 ring-1 ring-blue-500 shadow-md"
                              : "border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                <span
                                  className="font-black text-slate-800 text-base truncate flex-1 mr-1"
                                  title={item.style}
                                >
                                  {item.style}
                                </span>
                              </div>
                              <span className="text-xs font-bold font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200 shrink-0">
                                {item.po}
                              </span>
                            </div>

                            <div
                              className="text-xs text-slate-600 mb-2 truncate font-medium"
                              title={`${item.mau} - ${item.don}`}
                            >
                              {item.mau} - {item.don}
                            </div>
                          </div>

                          <div className="flex justify-between items-end mt-1 pt-1 border-t border-slate-50">
                            <div className="flex flex-col gap-1">
                              {item.nhom && (
                                <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded truncate max-w-[80px] font-bold border border-blue-100">
                                  {item.nhom}
                                </span>
                              )}
                              {item.shipdate && (
                                <span className="text-[9px] text-slate-400 flex items-center">
                                  <Calendar size={10} className="mr-1" />{" "}
                                  {item.shipdate}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <div
                                className="bg-slate-100 text-slate-600 px-1.5 py-1 rounded text-[10px] font-bold border border-slate-200 min-w-[45px] text-center"
                                title="Kế Hoạch"
                              >
                                {formatDecimal(item.kh)}
                              </div>
                              <div
                                className={`px-1.5 py-1 rounded text-[10px] font-bold border min-w-[45px] text-center ${
                                  diff > 0
                                    ? "bg-orange-100 text-orange-700 border-orange-200"
                                    : "bg-orange-50 text-orange-600 border-orange-100"
                                }`}
                                title="Chênh lệch"
                              >
                                {diff > 0 ? "+" : ""}
                                {formatDecimal(diff)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!showAllInput && filteredItems.length > 50 && (
                      <div className="col-span-2 py-3 px-2">
                        <button
                          onClick={() => setShowAllInput(true)}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 rounded-lg text-sm border border-slate-200 transition"
                        >
                          Hiển thị tất cả ({filteredItems.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedItem && (
                <div className="bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 animate-in slide-in-from-bottom-10">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-bold text-blue-700 truncate pr-2">
                      {selectedItem.style}{" "}
                      <span className="font-normal text-slate-500 text-xs">
                        ({selectedItem.mau})
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* PO, Đơn Hàng, and Xuất Dư Display */}
                  <div className="flex gap-2 mb-2 text-xs items-center">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold border border-blue-200">
                      PO: {selectedItem.po}
                    </span>
                    <span className="bg-slate-50 text-slate-700 px-2 py-1 rounded font-medium border border-slate-200">
                      Đơn: {selectedItem.don}
                    </span>
                    {/* Xuất Dư Warning - Right Side */}
                    {selectedItem.xuatDu === "x" && (
                      <span className="ml-auto px-2 py-1 bg-orange-50 border-2 border-orange-400 rounded flex items-center gap-1">
                        <AlertTriangle
                          size={14}
                          className="text-orange-600 shrink-0"
                        />
                        <span className="text-xs font-bold text-orange-700">
                          Có xuất dư
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-center border-r border-slate-200">
                      <div className="text-[10px] text-slate-400 uppercase">
                        Kế hoạch
                      </div>
                      <div className="font-bold text-slate-700">
                        {formatDecimal(selectedItem.kh)}
                      </div>
                    </div>
                    <div className="text-center border-r border-slate-200">
                      <div className="text-[10px] text-slate-400 uppercase">
                        Đã báo
                      </div>
                      <div className="font-bold text-blue-600">
                        {formatDecimal(selectedItem.current)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400 uppercase">
                        +/- KH
                      </div>
                      {(() => {
                        const diff =
                          (selectedItem.current || 0) -
                          (Number(selectedItem.kh) || 0);
                        return (
                          <div
                            className={`font-bold ${
                              diff > 0 ? "text-red-500" : "text-green-600"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {formatDecimal(diff)}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute top-1 left-2 text-[10px] font-bold text-slate-400">
                        NK:{" "}
                        {formatDecimal(
                          (parseFloat(qty) || 0) - (selectedItem.current || 0)
                        )}
                      </div>
                      <input
                        ref={qtyInputRef}
                        type="number"
                        inputMode="decimal"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitData(e)}
                        className="w-full pl-4 pr-10 pt-5 pb-2 bg-slate-50 border border-slate-300 rounded-xl text-xl font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                        placeholder="Nhập tổng luỹ kế..."
                      />
                      <button
                        onClick={handleAutoFill}
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-r-xl transition"
                        title="Báo đủ"
                      >
                        <Zap size={18} />
                      </button>
                    </div>
                    <button
                      onClick={submitData}
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 active:scale-[0.95] disabled:opacity-70 text-white font-bold px-5 rounded-xl transition flex items-center justify-center shadow-lg shadow-blue-100"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Save size={20} />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- REPORT VIEW --- */}
          {activeTab === "report" && (
            <div className="h-full flex flex-col bg-slate-50">
              <div className="p-3 bg-white border-b border-slate-200 shrink-0 space-y-2 shadow-sm">
                {/* Row 1: Date picker */}
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => fetchReport(true)}
                    disabled={loadingReport}
                    className="px-3 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md active:scale-95 transition flex items-center gap-1 justify-center disabled:opacity-50"
                    title="Làm mới dữ liệu"
                  >
                    {loadingReport ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </button>
                </div>

                {/* Row 2: Filters */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Product Code Filter */}
                  <div className="relative">
                    <select
                      value={reportFilterMa}
                      onChange={(e) => setReportFilterMa(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 appearance-none truncate"
                    >
                      <option value="">Tất cả Mã Hàng</option>
                      {availableReportMas
                        .sort((a, b) => {
                          // Sort: numbers first, then text
                          const aNum = !isNaN(Number(a));
                          const bNum = !isNaN(Number(b));
                          if (aNum && bNum) return Number(a) - Number(b);
                          if (aNum) return -1;
                          if (bNum) return 1;
                          return a.localeCompare(b);
                        })
                        .map((ma, idx) => (
                          <option key={idx} value={ma}>
                            {ma}
                          </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>

                  {/* ⚡ PO Input - Numeric for mobile keyboard */}
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={reportFilterPo}
                      onChange={(e) =>
                        setReportFilterPo(e.target.value.toUpperCase())
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 uppercase"
                      placeholder="Nhập PO..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {loadingReport && (
                  <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2
                        className="animate-spin text-blue-500"
                        size={32}
                      />
                      <span className="text-xs font-medium text-slate-500">
                        Đang tải dữ liệu...
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-[18%_10%_12%_24%_12%_12%_12%] gap-0.5 px-2 py-2 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                  <div className="text-left pl-1">Style</div>
                  <div>Màu</div>
                  <div>Đơn</div>
                  <div>PO</div>
                  <div>Nhóm</div>
                  <div>NK</div>
                  <div className="text-right pr-1">Luỹ Kế</div>
                </div>

                <div className="overflow-y-auto h-full pb-20 divide-y divide-slate-100 bg-white custom-scrollbar">
                  {displayedReportData.length === 0 && !loadingReport ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                      <Search size={32} className="opacity-20" />
                      <span className="text-xs">Chưa có dữ liệu hiển thị</span>
                    </div>
                  ) : (
                    displayedReportData.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[18%_10%_12%_24%_12%_12%_12%] gap-0.5 px-2 py-2.5 text-xs hover:bg-slate-50 transition items-center border-b border-slate-50"
                      >
                        <div className="text-left font-bold text-slate-800 break-words leading-tight pl-1">
                          {item.style}
                        </div>
                        <div className="text-center text-slate-600 break-words leading-tight text-[11px]">
                          {item.mau}
                        </div>
                        <div className="text-center text-slate-600 break-words leading-tight text-[11px]">
                          {item.don}
                        </div>
                        <div
                          className="text-center text-blue-800 font-bold text-xs sm:text-sm truncate"
                          title={item.po}
                        >
                          {item.po}
                        </div>
                        <div className="text-center">
                          {item.nhom ? (
                            <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[9px] font-medium inline-block truncate max-w-full">
                              {item.nhom}
                            </span>
                          ) : (
                            "-"
                          )}
                        </div>
                        <div className="text-center font-bold text-slate-700 text-sm">
                          {formatDecimal(item.nk)}
                        </div>
                        <div className="text-right font-bold text-blue-700 text-sm pr-1">
                          {formatDecimal(item.qty)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="p-3 bg-white border-t border-slate-200 shrink-0 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Tổng NK Ngày
                </span>
                <span className="text-xl font-bold text-blue-600">
                  {formatDecimal(
                    displayedReportData.reduce(
                      (acc, curr) => acc + (parseFloat(curr.nk) || 0),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          )}
        </main>

        <Modal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title="Backend Script"
          icon={Code}
        >
          <div className="space-y-4 text-sm text-slate-600">
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs border border-blue-100 flex items-start gap-2">
              <HelpCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Lưu ý:</strong> Script đã được tối ưu với CacheService
                (5 phút). Copy và deploy vào Google Apps Script.
              </span>
            </div>
            <div className="relative group">
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto font-mono border border-slate-700 custom-scrollbar h-40">
                {BACKEND_SCRIPT}
              </pre>
              <button
                onClick={copyCode}
                className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-xs backdrop-blur-sm flex items-center gap-1"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>
        </Modal>

        <Toast
          show={toast.show}
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      </div>
    </div>
  );
}
