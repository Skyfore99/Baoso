// @ts-nocheck
/* eslint-disable */
import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

// --- CONFIG ---
const HARDCODED_API_URL = "";

// --- BACKEND SCRIPT TEMPLATE ---
const BACKEND_SCRIPT = `const SHEET_DATA = "Data";
const SHEET_CONFIG = "Config";

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
      
      const currentTotal = getCumulative(sheet, request.po, request.ma, request.mau);
      const newTotal = parseFloat((currentTotal + qty).toFixed(2));
      
      if (limit > 0 && (newTotal > limit)) {
        return responseJSON({ 
          status: "error", 
          message: "Vượt KH! (" + newTotal + "/" + limit + ")" 
        });
      }
      
      sheet.appendRow([
        new Date(), "'" + request.po, request.don, request.ma, request.style, request.mau, request.shipdate, request.nhom, qty
      ]);

      updateConfigSheet(doc, request, newTotal);
      
      return responseJSON({ status: "success", total: newTotal, msg: request.style + ' (' + request.mau + ')' });
    }
    else if (action === "get_config") {
      return handleGetConfig(doc);
    }
    else if (action === "get_summary") {
      let sheet = doc.getSheetByName(SHEET_DATA);
      return responseJSON({ status: "success", data: getDailyData(sheet, request.date) });
    }
  } catch (error) { return responseJSON({ status: "error", message: error.toString() }); } 
  finally { lock.releaseLock(); }
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
  
  const configData = sheetConfig.getRange(2, 1, lastRow - 1, 9).getValues();
  
  const items = configData.map(r => {
    let shipdate = r[5];
    if (shipdate instanceof Date) shipdate = Utilities.formatDate(shipdate, Session.getScriptTimeZone(), "dd/MM/yyyy");
    else shipdate = String(shipdate || "");

    return {
      ma: String(r[0]), 
      style: String(r[1]), 
      mau: String(r[2]), 
      don: String(r[3]), 
      po: String(r[4]),
      shipdate: shipdate,
      kh: Number(r[6]) || 0,        
      nhom: String(r[7] || ""),     
      current: Number(r[8]) || 0    
    };
  }).filter(item => item.ma);
  
  return responseJSON({ status: "success", items: items });
}

function responseJSON(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }

function getCumulative(sheet, po, ma, mau) {
  const data = sheet.getDataRange().getValues();
  let total = 0;
  for (let i = 1; i < data.length; i++) {
    let rowPO = String(data[i][1]);
    if(rowPO.startsWith("'")) rowPO = rowPO.substring(1);
    if (rowPO==String(po) && String(data[i][3])==String(ma) && String(data[i][5])==String(mau)) {
      total += Number(data[i][8]);
    }
  }
  return total;
}

function getDailyData(sheet, dateString) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const results = [];
  
  const totalsMap = {}; 
  
  for (let i = 1; i < data.length; i++) {
     let p = String(data[i][1]); if(p.startsWith("'")) p = p.substring(1);
     let key = p + "_" + data[i][3] + "_" + data[i][5];
     totalsMap[key] = (totalsMap[key] || 0) + (Number(data[i][8]) || 0);
  }

  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = new Date(data[i][0]);
    const rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    if (rowDateStr === dateString) {
      let rowPO = String(data[i][1]);
      if(rowPO.startsWith("'")) rowPO = rowPO.substring(1);
      
      let rowShip = data[i][6];
      if (rowShip instanceof Date) rowShip = Utilities.formatDate(rowShip, Session.getScriptTimeZone(), "dd/MM/yyyy");
      
      let key = rowPO + "_" + data[i][3] + "_" + data[i][5];

      results.push({ 
        time: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "HH:mm"), 
        po: rowPO, don: data[i][2], ma: data[i][3], style: data[i][4], mau: data[i][5], 
        shipdate: rowShip, nhom: data[i][7],
        qty: totalsMap[key] || 0 
      });
    }
  }
  return results;
}
`;

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
  // --- STATE ---
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
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [isManualMode, setIsManualMode] = useState(false);

  const [filters, setFilters] = useState({
    ma: "",
    style: "",
    mau: "",
    don: "",
    po: "",
    shipdate: "",
  });
  const [manualData, setManualData] = useState({
    ma: "",
    style: "",
    mau: "",
    don: "",
    po: "",
    shipdate: "",
    qty: "",
  });
  const [persistentGroup, setPersistentGroup] = useState("");
  const [qty, setQty] = useState("");

  const [availableGroups, setAvailableGroups] = useState([]);
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportData, setReportData] = useState([]);
  const [reportFilterMa, setReportFilterMa] = useState("");

  const [toast, setToast] = useState({ show: false, msg: "", type: "info" });
  const qtyInputRef = useRef(null);

  // --- EFFECTS ---
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
    // Fix iOS Zoom: thêm media query ép font size 16px cho input trên mobile
    style.innerHTML = `
      body { font-family: 'Inter', sans-serif; } 
      ::-webkit-scrollbar { width: 5px; height: 5px; } 
      ::-webkit-scrollbar-track { background: transparent; } 
      ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      @media screen and (max-width: 768px) {
        input, select, textarea { font-size: 16px !important; }
      }
    `;
    document.head.appendChild(style);

    const savedUrl = localStorage.getItem("gas_api_url") || HARDCODED_API_URL;
    if (savedUrl) {
      setApiUrl(savedUrl);
      loadConfig(savedUrl, false);
    } else {
      setShowConfig(true);
    }
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
    if (masterItems.length > 0) {
      const result = masterItems.filter((item) => {
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
            item.shipdate
              .toLowerCase()
              .includes(filters.shipdate.toLowerCase()))
        );
      });
      setFilteredItems(result);
    }
  }, [filters, masterItems]);

  useEffect(() => {
    if (activeTab === "report") fetchReport();
  }, [activeTab]);

  // --- HELPERS ---
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

  const saveConfig = () => {
    if (!apiUrl.trim()) return showToast("Vui lòng nhập URL", "error");
    localStorage.setItem("gas_api_url", apiUrl);
    showToast("Đã lưu cấu hình", "success");
    setShowConfig(false);
    loadConfig(apiUrl, false);
  };

  const loadConfig = async (url, silent = false) => {
    const targetUrl = url || apiUrl;
    if (!targetUrl) return;
    if (!silent) {
      setIsConfigLoading(true);
      setSyncStatus("syncing");
    }
    try {
      const res = await fetchGAS(targetUrl, { action: "get_config" });
      if (res.status === "success") {
        setMasterItems(res.items || []);
        if (!silent) {
          setFilteredItems(res.items || []);
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

  const handleManualChange = (e) => {
    setManualData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    if (item.nhom) {
      setPersistentGroup(item.nhom);
    }
    setTimeout(() => {
      if (qtyInputRef.current) qtyInputRef.current.focus();
    }, 100);
  };

  const handleAutoFill = () => {
    if (!selectedItem) return;
    const remaining = Number(selectedItem.kh) - selectedItem.current;
    if (remaining > 0) {
      setQty(String(remaining));
      if (qtyInputRef.current) qtyInputRef.current.focus();
    } else showToast("Đã nhập đủ KH", "info");
  };

  const submitData = async () => {
    if (!apiUrl) return showToast("Chưa kết nối Backend", "error");
    const currentGroup = persistentGroup;
    let payload = { action: "add", nhom: currentGroup };
    let inputQty = 0;

    if (isManualMode) {
      if (!manualData.style || !manualData.qty)
        return showToast("Thiếu Style/SL", "error");
      payload = { ...payload, ...manualData };
      inputQty = parseFloat(manualData.qty);
    } else {
      if (!selectedItem) return showToast("Chưa chọn mã", "error");
      if (!qty) return showToast("Chưa nhập SL", "error");
      payload = {
        ...payload,
        po: selectedItem.po,
        don: selectedItem.don,
        ma: selectedItem.ma,
        style: selectedItem.style,
        mau: selectedItem.mau,
        shipdate: selectedItem.shipdate,
        limit: selectedItem.kh,
        qty: qty,
      };
      inputQty = parseFloat(qty);
    }

    if (isManualMode) {
      setManualData((prev) => ({ ...prev, qty: "" }));
      showToast("Đã lưu (Thủ công)", "success");
    } else {
      const newTotal = (selectedItem.current || 0) + inputQty;
      const updatedItem = { ...selectedItem, current: newTotal };
      setSelectedItem(updatedItem);
      setMasterItems((prev) =>
        prev.map((i) => (i === selectedItem ? updatedItem : i))
      );
      setQty("");
      showToast("Đã lưu!", "success");
      if (qtyInputRef.current) qtyInputRef.current.focus();
    }

    fetchGAS(apiUrl, payload)
      .then((res) => {
        if (res.status !== "success")
          showToast(res.message || "Lỗi Server!", "error");
      })
      .catch(() => showToast("Lỗi mạng!", "error"));
  };

  const fetchReport = async () => {
    if (!apiUrl) return;
    setLoadingReport(true);
    setReportFilterMa("");
    try {
      const res = await fetchGAS(apiUrl, {
        action: "get_summary",
        date: reportDate,
      });
      if (res.status === "success") {
        setReportData(res.data);
      }
    } catch (e) {
      showToast("Lỗi tải báo cáo", "error");
    } finally {
      setLoadingReport(false);
    }
  };

  const uniqueReportMas = [
    ...new Set(reportData.map((item) => item.ma).filter(Boolean)),
  ];
  const displayedReportData = reportFilterMa
    ? reportData.filter((item) => item.ma === reportFilterMa)
    : reportData;
  const copyCode = () =>
    navigator.clipboard
      .writeText(BACKEND_SCRIPT)
      .then(() => showToast("Đã copy code"));

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

        {/* CONFIG PANEL */}
        <div
          className={`bg-slate-50 border-b border-slate-200 p-4 absolute top-[64px] left-0 w-full z-20 transition-all duration-300 shadow-lg ${
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
              {/* GROUP INPUT */}
              <div className="px-3 pt-3 pb-1 bg-white shrink-0 z-10">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1 min-w-[50px]">
                    <Layers size={14} /> Nhóm
                  </div>
                  <div className="relative flex-1">
                    <input
                      list="dl_groups"
                      value={persistentGroup}
                      onChange={(e) => setPersistentGroup(e.target.value)}
                      className="w-full p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-800 focus:outline-none focus:border-blue-500 transition placeholder-blue-300"
                      placeholder="Nhập hoặc chọn Nhóm..."
                    />
                    <datalist id="dl_groups">
                      {availableGroups.map((g, i) => (
                        <option key={i} value={g} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="px-3 py-2 bg-white border-b border-slate-100 shadow-sm shrink-0 flex justify-between items-center z-10">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                  {isManualMode ? (
                    <>
                      <Edit3 size={12} /> Nhập Thủ Công
                    </>
                  ) : (
                    <>
                      <Filter size={12} /> Bộ Lọc Tìm Kiếm
                    </>
                  )}
                </div>
                <button
                  onClick={() => setIsManualMode(!isManualMode)}
                  className={`text-xs px-2 py-1 rounded-md font-semibold transition flex items-center gap-1 ${
                    isManualMode
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {isManualMode ? (
                    <>
                      <List size={12} /> Chọn từ list
                    </>
                  ) : (
                    <>
                      <Plus size={12} /> Nhập tay
                    </>
                  )}
                </button>
              </div>

              {/* SELECT FROM LIST */}
              {!isManualMode && (
                <>
                  <div className="p-3 bg-white border-b border-slate-100 shrink-0 space-y-2 z-10">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        id="ma"
                        value={filters.ma}
                        onChange={handleFilterChange}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none uppercase"
                        placeholder="Mã..."
                      />
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
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        id="don"
                        value={filters.don}
                        onChange={handleFilterChange}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none"
                        placeholder="Đơn..."
                      />
                      <input
                        id="po"
                        value={filters.po}
                        onChange={handleFilterChange}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none uppercase"
                        placeholder="PO..."
                      />
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                          <Calendar size={12} className="text-slate-400" />
                        </div>
                        <input
                          id="shipdate"
                          value={filters.shipdate}
                          onChange={handleFilterChange}
                          className="w-full pl-7 pr-2 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-blue-500 outline-none"
                          placeholder="ShipDate..."
                        />
                      </div>
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
                      <div className="space-y-2 pb-20">
                        {filteredItems.slice(0, 50).map((item, idx) => {
                          const diff =
                            (item.current || 0) - (Number(item.kh) || 0);
                          return (
                            <div
                              key={idx}
                              onClick={() => handleSelectItem(item)}
                              className={`bg-white p-3 rounded-lg border cursor-pointer transition-all active:scale-[0.98] ${
                                selectedItem === item
                                  ? "border-blue-500 ring-1 ring-blue-500 shadow-md"
                                  : "border-slate-200 hover:border-blue-300"
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center flex-wrap gap-2 mb-1">
                                    <span className="font-black text-slate-800 text-lg leading-none">
                                      {item.style}
                                    </span>
                                    <span className="bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                      {item.po}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium">
                                    {item.mau} - {item.don}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.nhom && (
                                      <div className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded font-medium">
                                        {item.nhom}
                                      </div>
                                    )}
                                    {item.shipdate && (
                                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                        <Calendar size={10} /> {item.shipdate}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 pl-2">
                                  <div
                                    className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200 min-w-[60px] text-center"
                                    title="Kế Hoạch"
                                  >
                                    {formatDecimal(item.kh)}
                                  </div>
                                  <div
                                    className={`px-2 py-1 rounded text-xs font-bold border min-w-[60px] text-center ${
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
                        {filteredItems.length > 50 && (
                          <div className="text-center text-xs text-slate-400 py-2">
                            Còn {filteredItems.length - 50} kết quả khác...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedItem && (
                    <div className="bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 animate-in slide-in-from-bottom-10">
                      <div className="flex justify-between items-center mb-3">
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
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calculator size={16} className="text-blue-500" />
                          </div>
                          <input
                            ref={qtyInputRef}
                            type="number"
                            inputMode="decimal"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && submitData()}
                            className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xl font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                            placeholder="Nhập số lượng..."
                          />
                          <button
                            onClick={handleAutoFill}
                            className="absolute inset-y-0 right-0 px-3 flex items-center text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-r-xl transition"
                            title="Báo đủ"
                          >
                            <Zap size={18} />
                          </button>
                        </div>
                        <button
                          onClick={submitData}
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
                </>
              )}

              {/* MODE 2: MANUAL ENTRY */}
              {isManualMode && (
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 custom-scrollbar">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          Style
                        </label>
                        <input
                          id="style"
                          value={manualData.style}
                          onChange={handleManualChange}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 uppercase focus:bg-white focus:border-blue-500 outline-none"
                          placeholder="Nhập Style..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          Màu Sắc
                        </label>
                        <input
                          id="mau"
                          value={manualData.mau}
                          onChange={handleManualChange}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:bg-white focus:border-blue-500 outline-none"
                          placeholder="Nhập Màu..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          Đơn Hàng
                        </label>
                        <input
                          id="don"
                          value={manualData.don}
                          onChange={handleManualChange}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:bg-white focus:border-blue-500 outline-none"
                          placeholder="Nhập Đơn..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          Mã Hàng
                        </label>
                        <input
                          id="ma"
                          value={manualData.ma}
                          onChange={handleManualChange}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:bg-white focus:border-blue-500 outline-none uppercase"
                          placeholder="Nhập Mã..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          PO
                        </label>
                        <input
                          id="po"
                          value={manualData.po}
                          onChange={handleManualChange}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:bg-white focus:border-blue-500 outline-none uppercase"
                          placeholder="Nhập PO..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          ShipDate
                        </label>
                        <input
                          id="shipdate"
                          value={manualData.shipdate}
                          onChange={handleManualChange}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:bg-white focus:border-blue-500 outline-none"
                          placeholder="Ngày giao..."
                        />
                      </div>
                    </div>
                    <div className="h-px bg-slate-100 w-full my-2"></div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-blue-600 uppercase">
                        Số Lượng
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Calculator size={16} className="text-slate-400" />
                        </div>
                        <input
                          type="number"
                          id="qty"
                          inputMode="decimal"
                          value={manualData.qty}
                          onChange={handleManualChange}
                          className="w-full pl-10 pr-4 py-3 bg-blue-50/50 border-2 border-blue-100 rounded-xl text-2xl font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <button
                      onClick={submitData}
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 transition flex justify-center items-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <span>LƯU DỮ LIỆU</span>
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
              <div className="p-3 bg-white border-b border-slate-200 flex gap-2 shadow-sm shrink-0">
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-1/3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500"
                />
                <div className="relative flex-1">
                  <select
                    value={reportFilterMa}
                    onChange={(e) => setReportFilterMa(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 appearance-none truncate"
                  >
                    <option value="">Tất cả Mã Hàng</option>
                    {[
                      ...new Set(
                        reportData.map((item) => item.ma).filter(Boolean)
                      ),
                    ].map((ma, idx) => (
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
                <button
                  onClick={fetchReport}
                  className="px-3 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md active:scale-95 transition flex items-center gap-1 justify-center"
                >
                  <Search size={16} />
                </button>
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

                {/* Custom Report Header - NEW LAYOUT (Grid Percentage) */}
                {/* Order: Style(18) | Mau(10) | PO(28) | Ship(14) | Nhom(18) | Qty(12) */}
                <div className="grid grid-cols-[20%_12%_24%_16%_14%_14%] gap-0.5 px-2 py-2 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                  <div className="text-left pl-1">Style</div>
                  <div>Màu</div>
                  <div>PO</div>
                  <div>Ship</div>
                  <div>Nhóm</div>
                  <div className="text-right pr-1">Luỹ Kế</div>
                </div>

                <div className="overflow-y-auto h-full pb-20 divide-y divide-slate-100 bg-white custom-scrollbar">
                  {(reportFilterMa
                    ? reportData.filter((item) => item.ma === reportFilterMa)
                    : reportData
                  ).length === 0 && !loadingReport ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                      <Search size={32} className="opacity-20" />
                      <span className="text-xs">Chưa có dữ liệu hiển thị</span>
                    </div>
                  ) : (
                    (reportFilterMa
                      ? reportData.filter((item) => item.ma === reportFilterMa)
                      : reportData
                    ).map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[20%_12%_24%_16%_14%_14%] gap-0.5 px-2 py-2.5 text-xs hover:bg-slate-50 transition items-center border-b border-slate-50"
                      >
                        {/* Style */}
                        <div className="text-left font-bold text-slate-800 break-words leading-tight pl-1">
                          {item.style}
                        </div>
                        {/* Màu */}
                        <div className="text-center text-slate-600 break-words leading-tight text-[11px]">
                          {item.mau}
                        </div>
                        {/* PO - Big & Bold */}
                        <div
                          className="text-center text-blue-800 font-bold text-xs sm:text-sm truncate"
                          title={item.po}
                        >
                          {item.po}
                        </div>
                        {/* ShipDate */}
                        <div className="text-center text-slate-500 font-mono text-[10px]">
                          {item.shipdate || "-"}
                        </div>
                        {/* Nhóm */}
                        <div className="text-center">
                          {item.nhom ? (
                            <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[9px] font-medium inline-block truncate max-w-full">
                              {item.nhom}
                            </span>
                          ) : (
                            "-"
                          )}
                        </div>
                        {/* Số lượng */}
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
                  Tổng số lượng
                </span>
                <span className="text-xl font-bold text-blue-600">
                  {formatDecimal(
                    displayedReportData.reduce(
                      (acc, curr) => acc + (parseFloat(curr.qty) || 0),
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
                <strong>Lưu ý:</strong> Cần thiết lập đúng cột trong Sheet
                Config.
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
